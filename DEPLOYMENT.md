# OmniLearn Deployment Guide

## Architecture

OmniLearn has **two components** that deploy separately:

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Vercel)           Backend (Railway/Render)       │
│  - React + Vite              - Express API server           │
│  - Static hosting            - PostgreSQL database          │
│  - /api/* → proxy to backend - /api/* endpoints             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Deploy Backend to Railway (Recommended)

### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

### Step 2: Deploy PostgreSQL
1. **New** → **Database** → **PostgreSQL**
2. Wait for provisioning (~30 seconds)
3. Copy the `DATABASE_URL` from the PostgreSQL service

### Step 3: Deploy API Server
1. **New** → **GitHub Repo** → Select `omnilearn-agent`
2. Railway auto-detects the `Dockerfile` and `railway.toml`
3. Add these environment variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://...` (from Railway DB) |
| `CLERK_SECRET_KEY` | `sk_test_...` |
| `CLERK_PUBLISHABLE_KEY` | `pk_test_...` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `PORT` | `3000` |

4. **Deploy** — Railway will build and start the server
5. Copy your Railway URL (e.g., `https://omnilearn-production-abc123.railway.app`)

### Step 4: Update Vercel Frontend
1. Open `vercel.json`
2. Replace `YOUR-RAILWAY-URL` with your actual Railway URL
3. Commit and push

---

## 🚀 Deploy Backend to Render

### Step 1: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub

### Step 2: Create Web Service
1. **New** → **Web Service**
2. Connect `omnilearn-agent` repo
3. Configure:
   - **Name**: `omnilearn-api`
   - **Environment**: `Docker`
   - **Build Command**: `docker build -t . -f Dockerfile`
   - **Start Command**: `pnpm --filter @workspace/api-server run start`

### Step 3: Add PostgreSQL
1. **New** → **PostgreSQL**
2. Copy the `DATABASE_URL` (internal or external)

### Step 4: Set Environment Variables
Same as Railway (see above)

### Step 5: Deploy
Render will build and deploy. Copy your `.onrender.com` URL.

---

## 🚀 Deploy Frontend to Vercel

### Step 1: Update vercel.json
Replace `YOUR-RAILWAY-URL` with your backend URL:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-backend.railway.app/api/:path*"
    }
  ]
}
```

### Step 2: Push to GitHub
```bash
git push origin main
```

### Step 3: Vercel Auto-Deploy
Vercel will automatically redeploy with the new API proxy.

---

## 🔧 Environment Variables

### Required (Backend)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
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
| `VITE_API_BASE_URL` | Backend API URL |

---

## ✅ Verify Deployment

1. **Backend Health Check**: Visit `https://your-backend.railway.app/api/healthz`
   - Should return: `{"status":"healthy"}`

2. **Frontend**: Visit your Vercel URL
   - Sign up should work
   - Chat should connect to backend

3. **API Routes**: Test `https://your-vercel-url.app/api/me`
   - Should proxy to backend

---

## 🐛 Troubleshooting

### Frontend can't connect to API
- Check `vercel.json` rewrites — URL must be correct
- Verify backend is running (check Railway logs)
- Ensure CORS is enabled (backend default allows all)

### Database connection errors
- Verify `DATABASE_URL` is correct
- Check Railway PostgreSQL is running
- Ensure database schema is pushed: `pnpm --filter @workspace/db run push`

### Clerk authentication fails
- Verify both `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY`
- Check Clerk dashboard → API Keys
- Ensure OAuth (Google/GitHub) is enabled in Clerk

---

## 📊 Cost Estimates

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Hobby | Free |
| Railway | Hobby | $5/month (PostgreSQL) |
| Render | Free | Free (with sleep) |
| Clerk | Free | 10,000 MAU free |
| Anthropic | Pay-as-you-go | ~$0.01-0.10 per conversation |

**Total: ~$5-10/month** for a production setup.

---

Questions? Open an issue on GitHub.
