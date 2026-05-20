# OmniLearn Backup Deployment Guide

**Three deployment options to avoid Railway outages**

---

## Quick Reference

| Provider | Setup Time | Free Tier | Best For |
|----------|-----------|-----------|----------|
| **Oracle Cloud** | 30 min | 4 CPU, 24GB RAM, 200GB | Primary production |
| **Fly.io** | 15 min | 3 VMs, 512MB each, 3GB | Quick deploy, easy rollback |
| **Hugging Face** | 10 min | 16GB RAM, 2 vCPU | Emergency backup, demos |

---

## Current Setup (Railway)

**Status:** ⚠️ Unreliable (service disruptions, trial limits)

**Action:** Keep as-is for now, but have backups ready

---

## 🥇 Primary: Oracle Cloud Free Tier

**Why:** Most generous free tier (4 CPU, 24GB RAM is insane)

**Setup Guide:** [`deploy/oracle-cloud/SETUP.md`](deploy/oracle-cloud/SETUP.md)

### Quick Start

```bash
# 1. Sign up at https://cloud.oracle.com
# 2. Create VM.Standard.A1.Flex instance (4 CPU, 24GB RAM)
# 3. SSH in and run setup script

ssh ubuntu@<your-ip>

# Run this on the server:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql nginx
npm install -g pnpm pm2

# Clone and deploy
git clone https://github.com/Cloud99p/omnilearn-agent.git
cd omnilearn-agent
pnpm install

# Create .env
cat > .env << EOF
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_test_...
EOF

# Start with PM2
cd artifacts/api-server
pm2 start src/index.ts --name omnilearn-api
pm2 save
pm2 startup
```

### Deploy Script

```bash
#!/bin/bash
# deploy-oracle.sh - Run on Oracle Cloud server

cd /home/ubuntu/omnilearn-agent
git pull origin main
pnpm install
cd artifacts/api-server
pm2 restart omnilearn-api
pm2 save

echo "✅ Deployed!"
```

### Cost
**$0/month** (always free tier)

---

## 🥈 Secondary: Fly.io

**Why:** Railway-like UX, easy rollback, global edge

**Setup Guide:** [`deploy/fly-io/SETUP.md`](deploy/fly-io/SETUP.md)

### Quick Start

```bash
# 1. Install Fly CLI
curl -L https://fly.io/install.sh | sh

# 2. Login
fly auth login

# 3. Create fly.toml (see deploy/fly-io/SETUP.md)
# 4. Create Dockerfile (see deploy/fly-io/SETUP.md)

# 5. Deploy
fly launch --no-deploy
fly deploy

# 6. Set secrets
fly secrets set CLERK_SECRET_KEY=sk_test_...
fly secrets set DATABASE_URL=postgresql://...
```

### Deploy Script

```bash
#!/bin/bash
# deploy-fly.sh

git checkout main
git pull origin main
fly deploy --remote-only
fly status
fly logs --recent

echo "✅ Deployed to Fly.io!"
```

### Cost
**$0-6/month** (free tier covers basic usage)

---

## 🥉 Emergency: Hugging Face Spaces

**Why:** Dead simple, generous resources, AI-focused

**Setup Guide:** [`deploy/huggingface/SETUP.md`](deploy/huggingface/SETUP.md)

### Quick Start

```bash
# 1. Create Space at https://huggingface.co/new-space
#    SDK: Docker, Visibility: Public

# 2. Create Dockerfile (see deploy/huggingface/SETUP.md)

# 3. Push code
git remote add hf https://huggingface.co/spaces/Emmanuel/omnilearn-agent
git push hf main

# 4. Set secrets in HF dashboard
#    Settings → Variables and secrets
```

### Deploy Script

```bash
#!/bin/bash
# deploy-hf.sh

git checkout main
git pull origin main
git push hf main

echo "✅ Deployed to Hugging Face!"
echo "🌐 https://huggingface.co/spaces/Emmanuel/omnilearn-agent"
```

### Cost
**$0/month** (public) or **$9/month** (private)

---

## Deployment Checklist

Before deploying anywhere:

```
□ Code tested locally (pnpm build succeeds)
□ Package imports correct (@omnilearn/* not @workspace/*)
□ packages/* in pnpm-workspace.yaml
□ .env file created with all secrets
□ DATABASE_URL points to working database
□ CLERK keys set
□ Dockerfile created (if needed)
□ Deploy script created
```

---

## Migration Strategy

### Phase 1: Set Up Oracle Cloud (This Week)
- [ ] Create Oracle Cloud account
- [ ] Create VM instance
- [ ] Run setup script
- [ ] Deploy OmniLearn
- [ ] Test all endpoints
- [ ] Point DNS to Oracle IP

### Phase 2: Set Up Fly.io (Backup)
- [ ] Create Fly.io account
- [ ] Create fly.toml and Dockerfile
- [ ] Deploy test version
- [ ] Verify it works
- [ ] Document rollback steps

### Phase 3: Set Up Hugging Face (Emergency)
- [ ] Create HF Space
- [ ] Create Dockerfile
- [ ] Deploy test version
- [ ] Verify it works
- [ ] Keep as emergency option

---

## Switching Between Providers

### Railway → Oracle Cloud

```bash
# 1. Deploy to Oracle (see above)
# 2. Update DNS to point to Oracle IP
# 3. Test thoroughly
# 4. Remove Railway deployment (optional)
```

### Railway → Fly.io

```bash
# 1. Create fly.toml and Dockerfile
# 2. fly deploy
# 3. fly secrets set (all env vars)
# 4. Update DNS to Fly.io IP
# 5. Test thoroughly
```

### Any → Hugging Face (Emergency)

```bash
# 1. git push hf main
# 2. Set secrets in HF dashboard
# 3. Wait for build (2-5 min)
# 4. Test at hf.space URL
```

---

## Monitoring & Alerts

### Oracle Cloud

```bash
# PM2 monitoring
pm2 monit

# System logs
journalctl -u omnilearn-api -f

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Fly.io

```bash
# Real-time logs
fly logs

# Dashboard
fly dashboard

# Metrics
fly status
```

### Hugging Face

```bash
# View in dashboard
# Space → Settings → Logs

# Or via API
curl https://huggingface.co/api/spaces/Emmanuel/omnilearn-agent/logs
```

---

## Rollback Procedures

### Oracle Cloud

```bash
# Rollback code
cd /home/ubuntu/omnilearn-agent
git revert HEAD
git pull origin main

# Restart
pm2 restart omnilearn-api
```

### Fly.io

```bash
# List releases
fly releases list

# Rollback
fly rollback <version>
```

### Hugging Face

```bash
# Revert commit
git revert <commit-hash>
git push hf main
```

---

## Cost Comparison

| Provider | Free Tier | Typical Cost | Max Scale |
|----------|-----------|--------------|-----------|
| Railway | $5 credit | $5-10/month | Medium |
| Oracle Cloud | 4 CPU, 24GB RAM | $0/month | High |
| Fly.io | 3 VMs, 512MB | $0-6/month | Medium |
| Hugging Face | 16GB RAM | $0-9/month | Medium |

---

## Decision Matrix

**Choose Oracle Cloud if:**
- ✅ You want maximum free resources
- ✅ You're comfortable with Linux/SSH
- ✅ You want full control
- ✅ You need reliability

**Choose Fly.io if:**
- ✅ You want Railway-like UX
- ✅ You want easy rollback
- ✅ You want global edge deployment
- ✅ You don't mind small free tier

**Choose Hugging Face if:**
- ✅ You need emergency backup
- ✅ You want simplest setup
- ✅ You're okay with public repo (free tier)
- ✅ You want AI-focused platform

---

## Next Steps

1. **This week:** Set up Oracle Cloud as primary
2. **Next week:** Set up Fly.io as secondary backup
3. **Anytime:** Set up Hugging Face as emergency option
4. **Ongoing:** Test deployments monthly to ensure they work

---

**Remember:** The best backup is the one you've actually tested. Deploy to at least one alternative before Railway fails you again!

🚀 Good luck!
