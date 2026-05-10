# Sentry Release Tracking - Full Stack

## Overview

Release tracking in Sentry helps you:
- ✅ Identify which deployment introduced a bug
- ✅ See error rates per version
- ✅ Auto-resolve issues when fixed in a release
- ✅ Get deploy notifications
- ✅ Track crash-free user % per release
- ✅ **Correlate frontend + backend errors by release**

---

## Configuration Complete

### ✅ Frontend (Vercel + React)

**Files Modified:**
1. `artifacts/omnilearn/vite.config.ts` - Injects release version
2. `artifacts/omnilearn/src/lib/sentry.ts` - Uses `VITE_SENTRY_RELEASE`

**Version Source (priority order):**
1. `VITE_SENTRY_RELEASE` env var (recommended)
2. `package.json` version (`1.0.0`)
3. Falls back to `"unknown"`

### ✅ Backend (Railway + Express)

**Files Modified:**
1. `artifacts/api-server/src/lib/sentry.ts` - Uses `SENTRY_RELEASE`
2. `.env.example` - Added `SENTRY_RELEASE` documentation
3. `railway.toml` - Added env var reference

**Version Source (priority order):**
1. `SENTRY_RELEASE` env var (recommended)
2. `package.json` version (`1.0.0`)
3. Falls back to `"unknown"`

---

## Vercel Setup (Frontend)

### Option 1: Automatic (Git Commit SHA) - Recommended

In Vercel Dashboard → Settings → Environment Variables:

```
VITE_SENTRY_RELEASE={{GIT_COMMIT_SHA}}
```

Vercel auto-replaces `{{GIT_COMMIT_SHA}}` with the actual commit hash on each deploy.

### Option 2: Manual Version

For simple versioning:

```
VITE_SENTRY_RELEASE=1.0.0
```

Update this manually before each deploy.

### Option 3: Use package.json Version

No env var needed — it already reads from `package.json`:
```json
{
  "version": "1.0.0"
}
```

---

## Railway Setup (Backend)

### Option 1: Manual Version - Recommended

In Railway Dashboard → Your Project → Variables:

```
SENTRY_RELEASE=1.0.0
```

Update before each deploy.

### Option 2: Git Commit SHA (Advanced)

Railway doesn't auto-inject commit SHA like Vercel. Use a build script:

```bash
# In Railway build command or Dockerfile
export SENTRY_RELEASE=$(git rev-parse --short HEAD)
```

### Option 3: Use package.json Version

No env var needed — reads from `artifacts/api-server/package.json`:
```json
{
  "version": "1.0.0"
}
```

---

## Add Environment Variables Now

### Frontend (Vercel)

Go to: https://vercel.com/dashboard → Your Project → Settings → Environment Variables

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_SENTRY_RELEASE` | `{{GIT_COMMIT_SHA}}` or `1.0.0` | Production + Preview |

**Then redeploy** for changes to take effect.

### Backend (Railway)

Go to: https://railway.app → Your Project → Variables

| Variable | Value |
|----------|-------|
| `SENTRY_RELEASE` | `1.0.0` (or commit SHA) |

**Then redeploy** for changes to take effect.

---

## View Releases in Sentry

### 1. Navigate to Releases Page

```
https://sentry.io/organizations/[your-org]/releases/
```

Or:
1. Go to https://sentry.io
2. Select your organization
3. Click **Releases** in left sidebar
4. You'll see both projects:
   - `omnilearn-frontend` (React/Vercel)
   - `node-express` (Express/Railway)

### 2. What You'll See

For each project:
- **Release name** (e.g., `1.0.0` or commit SHA)
- **Created** timestamp
- **First event** / **Last event**
- **Crash-free sessions** %
- **Crash-free users** %
- **Associated commits** (if repo connected)

### 3. Full-Stack Correlation

When both frontend and backend use the **same release version**:
- Click a release → See errors from **both** projects
- Correlate frontend errors with backend errors by version
- Identify if a bad deploy broke both layers

### 4. Release Details Page

Click any release to see:
- **Issues** in that release (all projects)
- **Commits** included
- **Deployments** (if connected to CI/CD)
- **Adoption** graph (users per version)
- **Crash-free** metrics

---

## Pro Tips

### Auto-Resolve Issues

When fixing a bug, in the issue dropdown select:
- **"Resolved in next release"** → Auto-closes when new release arrives

### Deploy Notifications

Connect your repo (GitHub/GitLab) to get:
- Email when new release has errors
- Slack/Discord notifications
- Commit author attribution

### Session Replay + Releases

Watch replays filtered by release:
1. Go to **Replays** tab
2. Filter by release version
3. See exactly what users experienced in that version

---

## Verify It's Working

### Frontend (Vercel)

After deploying with `VITE_SENTRY_RELEASE` set:

1. Open your app: https://omnilearn.dpdns.org
2. Check console for: `[Sentry] Initialized for production (traces: 10%)`
3. Trigger a test error:
   ```javascript
   throw new Error("Frontend release test error")
   ```
4. Go to Sentry → **Releases** → Should show `1.0.0` (or your version)!

### Backend (Railway)

After deploying with `SENTRY_RELEASE` set:

1. Check Railway logs for: `Sentry initialized successfully`
2. Trigger a backend error (e.g., hit an endpoint that throws)
3. Go to Sentry → **Releases** → Should show the same version!

### Full-Stack Verification

In Sentry → **Releases**:
- Both projects should show the **same release version**
- Click the release → See errors from both frontend and backend
- This confirms your full-stack release tracking is working! ✅

---

## Troubleshooting

### Release Shows "unknown"
- Env var not set in Vercel
- Redeploy after adding `VITE_SENTRY_RELEASE`

### No Releases Tab Visible
- Need at least one event with release info
- Trigger an error after setting up

### Commits Not Showing
- Connect GitHub repo in Sentry Settings → Integrations
- Requires repo permission

---

**Next:** After your next Vercel deploy, check the Releases page to see your version appear! 🚀
