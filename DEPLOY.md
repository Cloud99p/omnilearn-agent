# Deploy OmniLearn - Complete Step-by-Step Guide

**Time:** ~30 minutes  
**Cost:** Free tier (Vercel + Railway + Supabase)  
**Prerequisites:** GitHub account, Google account

---

## Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Vercel        │────▶│   Railway        │────▶│   Supabase      │
│   (Frontend)    │     │   (Backend)      │     │   (Database)    │
│   omnilearn.    │     │   workspaceapi-  │     │   PostgreSQL    │
│   dpdns.org     │     │   server...      │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         ▲                      ▲
         │                      │
         └──────────────────────┘
              Clerk (Auth)
```

---

## Step 1: Fork & Clone the Repository

```bash
# Fork on GitHub first, then:
git clone https://github.com/YOUR_USERNAME/omnilearn-agent.git
cd omnilearn-agent
```

---

## Step 2: Set Up Supabase (Database)

**Why:** You need a PostgreSQL database for the backend.

1. Go to **https://supabase.com**
2. Click **Start your project**
3. Fill in:
   - **Project name:** `omnilearn-db`
   - **Database password:** Generate a strong password (save it!)
   - **Region:** Choose closest to you
4. Click **Create new project**
5. Wait 2-3 minutes for provisioning
6. Go to **Project Settings** → **Database**
7. Copy the **Connection string** (URI mode):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
8. **Important:** Enable public access (for Railway):
   - Go to **Project Settings** → **Database** → **Connection pool**
   - Or add this to your SQL Editor:
     ```sql
     -- Allow connections from Railway IPs
     -- (Supabase allows all by default on free tier)
     ```

**Save:** You'll need this connection string for Railway.

---

## Step 3: Set Up Clerk (Authentication)

**Why:** Handle user sign-in (email/password, Google OAuth, etc.)

1. Go to **https://dashboard.clerk.com**
2. Click **Create Application**
3. Fill in:
   - **Name:** `OmniLearn`
   - **Recommended:** Select "Email, password, and SSO"
4. Click **Create Application**
5. Go to **API Keys** (left sidebar)
6. Copy both keys:
   - **Publishable Key** (starts with `pk_test_` or `pk_prod_`)
   - **Secret Key** (starts with `sk_test_` or `sk_prod_`)
7. **Enable Google OAuth** (optional but recommended):
   - Go to **Authentication** → **Social Connections**
   - Toggle **Google** to enable
   - Follow the OAuth setup flow (see "Google OAuth Setup" section below)

**Save:** You'll need both Clerk keys for Railway.

---

## Step 4: Deploy Backend to Railway

**Why:** Your Express API server needs a home.

1. Go to **https://railway.app**
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Choose your fork: `YOUR_USERNAME/omnilearn-agent`
5. Railway will auto-detect your project
6. **Add environment variables** (click "Variables" tab):

   | Key                     | Value                                                                 |
   | ----------------------- | --------------------------------------------------------------------- |
   | `DATABASE_URL`          | `postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres` |
   | `CLERK_PUBLISHABLE_KEY` | `pk_test_xxxxx` (from Clerk)                                          |
   | `CLERK_SECRET_KEY`      | `sk_test_xxxxx` (from Clerk)                                          |
   | `PORT`                  | `8080`                                                                |
   | `ANTHROPIC_API_KEY`     | `sk-ant-xxxxx` (if using Claude)                                      |

7. **Deploy:**
   - Go to **Deployments** tab
   - Click **Deploy**
   - Wait 3-5 minutes for build
8. **Get your Railway URL:**
   - Go to **Settings** → **Networking**
   - Click **Generate Domain**
   - Copy the URL (e.g., `https://workspaceapi-server-production-29ee.up.railway.app`)

**Test your backend:**

```bash
curl https://YOUR-RAILWAY-URL.up.railway.app/api/healthz
```

Expected response:

```json
{
  "status": "ok",
  "version": "0.0.0",
  "uptime": 45,
  "timestamp": "2026-05-07T12:00:00.000Z",
  "database": { "status": "connected", "latencyMs": 42 },
  "clerk": { "status": "configured" }
}
```

---

## Step 5: Deploy Frontend to Vercel

**Why:** Your React app needs static hosting.

1. Go to **https://vercel.com/new**
2. Click **Import Git Repository**
3. Select your fork: `YOUR_USERNAME/omnilearn-agent`
4. **Configure Project:**
   - **Framework Preset:** Vite (auto-detected)
   - **Build Command:** `pnpm -r --filter @workspace/omnilearn run build`
   - **Output Directory:** `artifacts/omnilearn/dist/public`
   - **Install Command:** `pnpm install --no-frozen-lockfile`
5. **Add environment variables:**

   | Key                          | Value                                     |
   | ---------------------------- | ----------------------------------------- |
   | `VITE_API_URL`               | `https://YOUR-RAILWAY-URL.up.railway.app` |
   | `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_xxxxx` (from Clerk)              |

6. Click **Deploy**
7. Wait 2-3 minutes for build
8. **Add custom domain** (optional):
   - Go to **Project Settings** → **Domains**
   - Add `omnilearn.dpdns.org` (or your domain)
   - Follow DNS configuration instructions

**Test your frontend:**

- Open your Vercel URL (e.g., `https://omnilearn-xxxx.vercel.app`)
- Try signing in
- Try sending a chat message

---

## Step 6: Push Database Schema

**Why:** Your database tables need to be created.

```bash
# From your local clone
cd omnilearn-agent

# Install dependencies
pnpm install

# Push schema to Supabase
pnpm run db:push
```

**Verify tables were created:**

1. Go to Supabase Dashboard
2. Click **Table Editor**
3. You should see tables like: `conversations`, `messages`, `skills`, etc.

---

## Step 7: Test Everything

### Health Check

```bash
curl https://YOUR-RAILWAY-URL.up.railway.app/api/healthz
```

### Sign In

1. Go to your Vercel URL
2. Click **Sign In**
3. Sign in with email or Google
4. You should be redirected to the dashboard

### Send a Message

1. Go to `/chat`
2. Type a message
3. You should get a response from Claude

### Check Logs (if something breaks)

- **Railway:** Click project → **Deployments** → **View Logs**
- **Vercel:** Click project → **Deployments** → **View Build Logs**
- **Supabase:** Click project → **Logs**

---

## Troubleshooting

### Backend won't start

```
Error: DATABASE_URL must be set
```

**Fix:** Add `DATABASE_URL` to Railway environment variables (Step 4)

### Frontend shows 404 on API calls

```
GET /api/healthz 404
```

**Fix:** Add `VITE_API_URL` to Vercel environment variables (Step 5)

### Clerk authentication fails

```
Clerk: Publishable key not found
```

**Fix:** Add both `CLERK_PUBLISHABLE_KEY` and `VITE_CLERK_PUBLISHABLE_KEY`

### Database connection timeout

```
Error: connect ETIMEDOUT
```

**Fix:**

1. Check Supabase project is active (not paused)
2. Verify DATABASE_URL format includes password
3. Check Railway logs for full error

### Build fails on Vercel

```
Error: ENOENT: no such file or directory
```

**Fix:**

1. Check `outputDirectory` in `vercel.json` matches your build output
2. Try building locally: `pnpm -r --filter @workspace/omnilearn run build`

---

## Google OAuth Setup (Optional but Recommended)

**Why:** Let users sign in with Google instead of just email/password.

### 1. Create Google Cloud Project

1. Go to **https://console.cloud.google.com**
2. Click **Select a project** → **New Project**
3. Name: `OmniLearn OAuth`
4. Click **Create**

### 2. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. **User type:** External
3. Fill in:
   - **App name:** OmniLearn
   - **User support email:** your-email@gmail.com
   - **Developer contact:** same email
4. Click **Save and Continue** (skip scopes)
5. Add your email as **Test user**
6. Click **Save and Continue**

### 3. Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. **Application type:** Web application
4. **Authorized JavaScript origins:**
   - `https://omnilearn.dpdns.org` (your Vercel domain)
   - `http://localhost:5173` (for local dev)
5. **Authorized redirect URIs:**
   - Go to Clerk → **Authentication** → **Social Connections** → **Google**
   - Copy the **Callback URL** (e.g., `https://omnilearn-xxxx.clerk.accounts.dev/v1/callback...`)
   - Paste it here
6. Click **Create**
7. Copy **Client ID** and **Client Secret**

### 4. Add to Clerk

1. Go to Clerk Dashboard → **Authentication** → **Social Connections** → **Google**
2. Paste **Client ID** and **Client Secret**
3. Click **Save**
4. Toggle Google to **Enabled**

### 5. Test

1. Go to your app's sign-in page
2. Click **Continue with Google**
3. Sign in with your Gmail
4. Should redirect back to your app

---

## CI/CD Pipeline

Your GitHub Actions CI automatically:

- ✅ Checks code format (Prettier)
- ✅ Runs TypeScript type checking
- ✅ Builds the project
- ✅ Verifies deployment configs exist

**View CI status:** https://github.com/YOUR_USERNAME/omnilearn-agent/actions

**To deploy updates:**

```bash
git push origin main
```

Railway and Vercel will auto-deploy on push.

---

## Cost Breakdown

| Service   | Plan          | Cost                           |
| --------- | ------------- | ------------------------------ |
| Vercel    | Hobby         | Free                           |
| Railway   | Starter       | $5 credit (then pay-as-you-go) |
| Supabase  | Free          | Free (500MB DB, 50K MAU)       |
| Clerk     | Free          | Free (10K MAU)                 |
| Anthropic | Pay-as-you-go | ~$0.01-0.10 per conversation   |

**Total:** ~$0-5/month for personal use

---

## Security Checklist

- ✅ Environment variables stored in Railway/Vercel (not in code)
- ✅ Database password is strong and unique
- ✅ Clerk keys are secret (never commit to GitHub)
- ✅ `.env` files are in `.gitignore`
- ✅ HTTPS enforced (Vercel + Railway default)
- ✅ CORS configured for your domains only

---

## Next Steps After Deployment

1. **Set up monitoring:**
   - Add Sentry for error tracking
   - Add UptimeRobot for uptime monitoring

2. **Configure custom domain:**
   - Buy domain (Namecheap, Cloudflare, etc.)
   - Point to Vercel (CNAME record)

3. **Enable rate limiting:**
   - Add rate limiting middleware to prevent abuse

4. **Set up backups:**
   - Supabase auto-backups (enabled by default)
   - Export conversations periodically

5. **Add analytics:**
   - Vercel Analytics (free)
   - Track feature usage

---

## Support

- **Documentation:** `/README.md`, `/CONTRIBUTING.md`
- **Issues:** https://github.com/YOUR_USERNAME/omnilearn-agent/issues
- **Discord:** [link if applicable]

---

**Last updated:** May 7, 2026  
**Version:** 0.1.0
