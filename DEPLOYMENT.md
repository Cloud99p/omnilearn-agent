# OmniLearn Deployment Guide

## Architecture

OmniLearn has **two components** that deploy separately:

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Vercel)           Backend (Render)               │
│  - React + Vite              - Express API server           │
│  - Static hosting            - PostgreSQL database          │
│  - /api/* → proxy to backend - /api/* endpoints             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Deploy Backend to Render (Recommended)

### Step 1: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub

### Step 2: Deploy from Blueprint
1. Click **New** → **Blueprint**
2. Click **Connect repository** and select `omnilearn-agent`
3. Render will detect `render.yaml` and show the configuration

### Step 3: Set Environment Variables
In the Blueprint setup, you'll see environment variables. Set these:

| Variable | Value |
|----------|-------|
| `CLERK_SECRET_KEY` | `sk_test_...` (from Clerk dashboard) |
| `CLERK_PUBLISHABLE_KEY` | `pk_test_...` (from Clerk dashboard) |
| `ANTHROPIC_API_KEY` | `sk-ant-...` (from Anthropic dashboard) |
| `PORT` | `3000` |

**Note:** `DATABASE_URL` is automatically set from the PostgreSQL database defined in `render.yaml`.

### Step 4: Apply Blueprint
1. Click **Apply**
2. Render will create:
   - **Web Service** (`omnilearn-api`) — your Express server
   - **PostgreSQL Database** (`omnilearn-db`) — your database
3. Wait for deployment (~3-5 minutes)

### Step 5: Get Your Backend URL
Once deployed:
1. Go to the **omnilearn-api** service dashboard
2. Copy the URL (e.g., `https://omnilearn-api.onrender.com`)

---

## 🚀 Deploy Frontend to Vercel

### Step 1: Update vercel.json
Replace `YOUR-RENDER-URL` with your actual Render URL:

```json
{
  "buildCommand": "pnpm -r --filter @workspace/omnilearn run build",
  "outputDirectory": "artifacts/omnilearn/dist/public",
  "installCommand": "pnpm install",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-RENDER-URL.onrender.com/api/:path*"
    }
  ]
}
```

### Step 2: Push to GitHub
```bash
git add -A
git commit -m "chore: update vercel.json with Render backend URL"
git push origin main
```

### Step 3: Vercel Auto-Deploy
Vercel will automatically redeploy with the new API proxy.

---

## 🔧 Environment Variables

### Required (Backend - Render)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Auto-set by Render from PostgreSQL |
| `CLERK_SECRET_KEY` | Clerk API secret key |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `PORT` | Server port (default: 3000) |

### Optional (Backend)
| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub OAuth for repo features |
| `GHOST_SECRET` | Ghost network secret key |

### Frontend (Vercel)
| Variable | Description |
|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Client-side Clerk key |

---

## ✅ Verify Deployment

### 1. Backend Health Check
Visit: `https://your-render-url.onrender.com/api/healthz`

Should return:
```json
{"status":"healthy"}
```

### 2. Frontend
Visit your Vercel URL (e.g., `https://omnilearn.vercel.app`)

- Sign up should work
- Chat should connect to backend
- No 404 errors on `/api/*` routes

### 3. API Routes
Test: `https://your-vercel-url.app/api/me`

Should proxy to Render backend and return user info (if authenticated).

---

## 🐛 Troubleshooting

### Frontend can't connect to API
- Check `vercel.json` rewrites — URL must be correct
- Verify backend is running (check Render logs)
- Ensure no CORS errors in browser console

### Database connection errors
- Render auto-sets `DATABASE_URL` — don't override it
- Check Render PostgreSQL is running
- Database schema auto-migrates on first deploy

### Clerk authentication fails
- Verify both `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY`
- Check Clerk dashboard → API Keys
- Ensure OAuth (Google/GitHub) is enabled in Clerk

### Render service goes to sleep
- Free tier services sleep after 15 min of inactivity
- Upgrade to **Starter** plan ($7/month) to prevent sleep
- Or use a uptime monitor (e.g., UptimeRobot) to ping every 5 min

---

## 📊 Cost Estimates

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Hobby | Free |
| Render Web Service | Starter | $7/month |
| Render PostgreSQL | Starter | $7/month |
| Clerk | Free | 10,000 MAU free |
| Anthropic | Pay-as-you-go | ~$0.01-0.10 per conversation |

**Total: ~$14-20/month** for a production setup.

---

## 🎯 Alternative: Single-Service Deployment

If you want to save money, deploy everything to Render (frontend + backend):

1. Update `render.yaml` to serve frontend from the same service
2. Configure static files in Dockerfile
3. Single service = $7/month total

Let me know if you want this setup!

---

Questions? Open an issue on GitHub.
