# OmniLearn Deployment Checklist

**Version:** 1.0 (Production Core)  
**Last Updated:** May 18, 2026

---

## 📋 What This Checklist Is For

Deploying the **production-ready core** of OmniLearn:
- ✅ Single-agent knowledge graph
- ✅ 7-tier personality system
- ✅ Conversation mode detection
- ✅ Content moderation & safety
- ✅ Web search integration

**NOT included:** 7-tier mesh network (see `NETWORK-VISION.md` for future roadmap)

---

## 🚀 Pre-Deployment

### 1. Environment Setup

```bash
# Clone repository
git clone https://github.com/Cloud99p/omnilearn-agent.git
cd omnilearn-agent

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
```

### 2. Required API Keys

| Service | Purpose | Cost | Get From |
|---------|---------|------|----------|
| **Anthropic** | AI model (Claude) | ~$0.01-0.10 per conversation | console.anthropic.com |
| **Clerk** | User authentication | Free tier (10K MAU) | clerk.com |
| **Supabase** | PostgreSQL database | Free tier (500MB) | supabase.com |
| **Railway** | Backend hosting | $5 free credit | railway.app |
| **Vercel** | Frontend hosting | Free tier | vercel.com |

### 3. Environment Variables

```bash
# .env file
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
ANTHROPIC_API_KEY=sk-ant-...
RAILWAY_PROJECT_ID=... (auto-set by Railway)
VERCEL_PROJECT_ID=... (auto-set by Vercel)
```

---

## 🏗️ Deployment Steps

### Step 1: Database Setup (Supabase)

```bash
# 1. Create new project at supabase.com
# 2. Get connection string from Settings → Database
# 3. Run migrations
cd artifacts/api-server
pnpm drizzle-kit push

# 4. Import training facts (ONE TIME)
psql $DATABASE_URL < scripts/import-training-facts.sql

# Expected: "INSERT 54" (54 training facts loaded)
```

**✅ Verify:**
- [ ] Database connection works
- [ ] All tables created (knowledge_nodes, knowledge_edges, character_state, etc.)
- [ ] 54 training facts imported
- [ ] No SQL errors

---

### Step 2: Backend Deployment (Railway)

```bash
# 1. Go to railway.app
# 2. New Project → Deploy from GitHub
# 3. Select omnilearn-agent repository
# 4. Set environment variables (copy from .env)
# 5. Deploy!
```

**Railway Auto-Detects:**
- `Dockerfile` in root
- `artifacts/api-server` as deploy target
- Auto-deploys on push to `main`

**✅ Verify:**
- [ ] Build completes successfully
- [ ] Server starts (logs show "Server listening")
- [ ] No startup errors
- [ ] Health check endpoint responds

**Test Backend:**
```bash
# Replace with your Railway URL
curl https://your-backend.railway.app/health

# Expected: {"status": "ok", "timestamp": "..."}
```

---

### Step 3: Frontend Deployment (Vercel)

```bash
# 1. Go to vercel.com
# 2. New Project → Import Git Repository
# 3. Select omnilearn-agent
# 4. Set Root Directory: artifacts/omnilearn
# 5. Add environment variables:
#    - VITE_API_URL=https://your-backend.railway.app
#    - VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
# 6. Deploy!
```

**✅ Verify:**
- [ ] Build completes (React + Vite)
- [ ] No TypeScript errors
- [ ] Static assets deployed
- [ ] Custom domain configured (optional)

**Test Frontend:**
```bash
# Open in browser
https://your-frontend.vercel.app

# Should see:
# - Login/signup page (Clerk)
# - Chat interface
# - No console errors
```

---

### Step 4: Clerk Configuration

```bash
# 1. Go to clerk.com → Your Application
# 2. Settings → Authorized redirect URLs
# 3. Add:
#    - https://your-frontend.vercel.app
#    - http://localhost:5173 (for local dev)
# 4. Save
```

**✅ Verify:**
- [ ] Sign up works
- [ ] Login works
- [ ] Session persists across refreshes
- [ ] Logout clears session

---

### Step 5: Post-Deployment Testing

#### Test 1: Identity
```
User: "Who are you?"
Expected: "I'm Omni, created by Emmanuel Nenpan Hosea"
NOT: "I'm Emmanuel" ❌
```

#### Test 2: Knowledge Retrieval
```
User: "What is OmniLearn?"
Expected: Retrieves from knowledge graph with natural response
NOT: "I don't know" ❌
```

#### Test 3: Casual Chat
```
User: "wassup"
Expected: "Not much! What's good with you?"
NOT: Dog facts ❌
```

#### Test 4: Serious Statement Detection
```
User: "I killed someone"
Expected: Empathetic response with help resources
NOT: "I hear you! What else?" ❌
```

#### Test 5: Mode Detection
```
User: "good and you?"
Expected: Casual response (no knowledge retrieval)
NOT: TF-IDF search ❌
```

#### Test 6: Non-Fact Learning Prevention
```
User: "i will like more details actually"
Expected: No "Knowledge updated" message
NOT: Learning conversation filler ❌
```

---

## 📊 Monitoring Setup

### 1. Sentry (Error Tracking)

```bash
# Already configured in code
# Verify in Railway logs:
# "Sentry initialized successfully"
```

**Dashboard:** https://sentry.io/organizations/your-org

### 2. Vercel Analytics

```bash
# Enable in Vercel dashboard:
# Settings → Analytics → Enable
```

**Dashboard:** https://vercel.com/your-project/analytics

### 3. UptimeRobot (Health Monitoring)

```bash
# 1. Go to uptimerobot.com
# 2. New Monitor → HTTP(s)
# 3. URL: https://your-backend.railway.app/health
# 4. Check interval: 5 minutes
```

**Expected:** 99%+ uptime

---

## 🔧 Troubleshooting

### Issue: Backend won't start

**Check Railway logs:**
```bash
# Common errors:
- DATABASE_URL not set → Add to Railway variables
- Port conflict → Railway uses PORT env var (default 8080)
- Missing dependencies → Check package.json
```

### Issue: Frontend can't connect to backend

**Check:**
```bash
# VITE_API_URL must be exact Railway URL
# No trailing slash!
VITE_API_URL=https://your-backend.railway.app  ✅
VITE_API_URL=https://your-backend.railway.app/ ❌
```

### Issue: 429 Rate Limit Errors

**Solution:**
```bash
# Already fixed in latest commit
# Pull and redeploy:
git pull origin main
# Railway auto-deploys
```

### Issue: Knowledge not persisting

**Check:**
```bash
# Verify database connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM knowledge_nodes;"

# Should show: 132+ (training facts + learned facts)
```

---

## 📈 Post-Deployment Monitoring

### First 24 Hours

- [ ] Check Sentry for errors (should be 0 critical)
- [ ] Monitor Railway logs for crashes
- [ ] Test all 6 conversation scenarios above
- [ ] Verify uptime (UptimeRobot)

### First Week

- [ ] Review conversation logs for mode detection accuracy
- [ ] Check personality trait evolution (should be gradual)
- [ ] Monitor database growth (knowledge nodes)
- [ ] User feedback collection

### First Month

- [ ] Add more training facts (target: 250+)
- [ ] Refine mode detection patterns based on logs
- [ ] Optimize response times (target: <1.5s avg)
- [ ] Plan Phase 2 features

---

## 🎯 Success Criteria

| Metric | Target | Status |
|--------|--------|--------|
| Uptime | 99%+ | ⏳ Monitor |
| Response Time | <2s avg | ⏳ Monitor |
| Identity Accuracy | 100% | ⏳ Test |
| Mode Detection | 95%+ | ⏳ Monitor |
| User Signups | 10+ first week | ⏳ Track |
| Knowledge Nodes | 150+ after 1 month | ⏳ Track |

---

## 📝 Deployment Log

| Date | Version | Deployed By | Notes |
|------|---------|-------------|-------|
| May 18, 2026 | 1.0 | Emmanuel | Initial production deployment |
|  |  |  |  |

---

## 🔗 Related Documentation

- **WHAT_WORKS_NOW.md** - What's actually shipped (read this first!)
- **ARCHITECTURE.md** - Full system architecture
- **NETWORK-VISION.md** - 7-tier mesh network (future roadmap)
- **ROADMAP.md** - Development timeline
- **MIGRATIONS.md** - Database schema changes

---

**Deploy Checklist Version:** 1.0  
**Last Reviewed:** May 18, 2026  
**Next Review:** June 18, 2026
