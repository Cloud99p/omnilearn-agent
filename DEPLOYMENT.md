# OmniLearn Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Vercel)           Backend (Railway)              │
│  - React + Vite              - Express API server           │
│  - Free static hosting       - $5 free credit/month         │
│  - /api/* → proxy to backend - PostgreSQL (Supabase - free) │
│                              - Anthropic API (paid)         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Deploy (5 Steps)

### 1. Get Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / Log in
3. Go to **Settings** → **API Keys**
4. Click **Create Key** → Copy it (starts with `sk-ant-`)
5. **$5 free credit** for new accounts

### 2. Create Supabase Database (Free)

1. Go to [supabase.com](https://supabase.com)
2. Sign up with GitHub
3. **New Project** → Name: `omnilearn`
4. Set **database password** (save it!)
5. Choose region → Create
6. Wait 2 minutes → Go to **Settings** → **Database**
7. Copy **Connection string** (URI format)

### 3. Get Clerk Keys

1. Go to [clerk.com](https://clerk.com)
2. Sign up → Create application
3. Copy **Secret Key** (`sk_test_...`)
4. Copy **Publishable Key** (`pk_test_...`)

### 4. Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Sign up → **New Project** → **Deploy from GitHub**
3. Select `omnilearn-agent`
4. Add variables (see below)
5. Deploy!

### 5. Update Vercel

1. Copy Railway URL
2. Update `vercel.json`
3. Push to GitHub
4. Done!

---

## 🔧 Environment Variables

### Railway (Backend)

| Variable                | Value              | Where to Get                                           |
| ----------------------- | ------------------ | ------------------------------------------------------ |
| `DATABASE_URL`          | `postgresql://...` | Supabase → Settings → Database                         |
| `CLERK_SECRET_KEY`      | `sk_test_...`      | Clerk → API Keys                                       |
| `CLERK_PUBLISHABLE_KEY` | `pk_test_...`      | Clerk → API Keys                                       |
| `ANTHROPIC_API_KEY`     | `sk-ant-...`       | [console.anthropic.com](https://console.anthropic.com) |
| `PORT`                  | `3000`             | (default)                                              |

### Vercel (Frontend)

| Variable                     | Value         | Where to Get     |
| ---------------------------- | ------------- | ---------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_...` | Clerk → API Keys |

---

## 📦 Detailed Deployment Steps

### Step 1: Anthropic API Key

```
1. Visit: https://console.anthropic.com
2. Sign up with email or Google
3. Navigate to: Settings → API Keys
4. Click "Create Key"
5. Name it: "omnilearn"
6. Copy the key (sk-ant-xxxxxxxxxxxxx)
7. Save it securely (you can't see it again!)
```

**Free tier:** $5 credit for new accounts (~500-1000 conversations)

---

### Step 2: Supabase PostgreSQL

```
1. Visit: https://supabase.com
2. Click "Start your project" or sign in
3. Click "New Project"
4. Organization: Select or create
5. Name: omnilearn
6. Database password: [create a strong password]
7. Region: Choose closest to you
8. Click "Create new project"
9. Wait ~2 minutes for provisioning
10. Go to: Settings (left sidebar) → Database
11. Find "Connection string" section
12. Click "URI" tab
13. Copy the string (includes your password)
```

Connection string format:

```
postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres
```

---

### Step 3: Clerk Authentication

```
1. Visit: https://clerk.com
2. Click "Get Started" or sign in
3. Create application:
   - Name: omnilearn
   - Select: Email + Password, Google, GitHub
4. Go to: API Keys (left sidebar)
5. Copy both keys:
   - Secret Key (sk_test_xxxxxxxxxxxxx)
   - Publishable Key (pk_test_xxxxxxxxxxxxx)
```

---

### Step 4: Railway Deployment

```
1. Visit: https://railway.app
2. Sign up with GitHub
3. Click "New Project"
4. Click "Deploy from GitHub repo"
5. Select: Cloud99p/omnilearn-agent
6. Railway auto-detects Dockerfile
7. Click on the project → Variables tab
8. Add these variables:

   DATABASE_URL=postgresql://postgres:[password]@db.xxx.supabase.co:5432/postgres
   CLERK_SECRET_KEY=sk_test_xxx
   CLERK_PUBLISHABLE_KEY=pk_test_xxx
   ANTHROPIC_API_KEY=sk-ant-xxx
   PORT=3000

9. Click "Deploy" at top
10. Wait 3-5 minutes for build
11. Once deployed: Settings → Domains
12. Copy URL: https://omnilearn-production-xxx.up.railway.app
```

---

### Step 5: Vercel Frontend

```
1. Open vercel.json in your repo
2. Replace YOUR-RAILWAY-URL with actual Railway URL:

{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-ACTUAL-URL.up.railway.app/api/:path*"
    }
  ]
}

3. Commit and push:

   git add vercel.json
   git commit -m "chore: update Railway backend URL"
   git push origin main

4. Vercel auto-deploys (~1 minute)
5. Visit your Vercel URL
```

---

## ✅ Verify Deployment

### 1. Test Backend

```
Visit: https://your-railway-url.up.railway.app/api/healthz

Expected: {"status":"healthy"}
```

### 2. Test Frontend

```
Visit: https://your-vercel-url.vercel.app

- Sign up should work
- Chat should connect
- No 404 errors on /api/*
```

### 3. Test API Proxy

```
Visit: https://your-vercel-url.vercel.app/api/healthz

Expected: {"status":"healthy"} (proxied from Railway)
```

---

## 🐛 Troubleshooting

### Build fails on Railway

- Check logs in Railway dashboard
- Verify all environment variables are set
- Ensure DATABASE_URL includes full connection string

### "ANTHROPIC_API_KEY must be set"

- Variable name is exactly `ANTHROPIC_API_KEY` (case-sensitive)
- Key starts with `sk-ant-`
- No extra spaces in the value

### Database connection error

- Supabase URL must include `?sslmode=require` at the end
- Check firewall: Supabase → Settings → Database → Connection pool → Enable
- Test in Supabase SQL editor first

### Clerk authentication fails

- Both `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` must be set
- Keys are `sk_test_` and `pk_test_` (not production keys)
- Enable Google/GitHub OAuth in Clerk dashboard

### Frontend 404 on /api/\*

- Check `vercel.json` rewrites — URL must match Railway exactly
- Railway service must be running (not crashed)
- Check Railway logs for errors

---

## 📊 Cost Breakdown

| Service   | Tier          | Cost                        |
| --------- | ------------- | --------------------------- |
| Vercel    | Hobby         | Free                        |
| Railway   | Hobby         | $5 credit/month (free)      |
| Supabase  | Free          | Free (500MB DB, 50K MAU)    |
| Clerk     | Free          | 10,000 MAU free             |
| Anthropic | Pay-as-you-go | $5 credit (new), then usage |

**Estimated total:** $0-10/month for moderate usage

---

## 🎯 Alternative: Stay on Replit

If external deployment is too complex, Replit works out-of-the-box:

- ✅ PostgreSQL included
- ✅ AI integration included (no Anthropic key needed)
- ✅ Free tier available
- ✅ Already configured

Just use your Replit URL!

---

Questions? Open an issue on GitHub.
