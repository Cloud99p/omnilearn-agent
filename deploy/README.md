# 🚀 Backup Deployment - Quick Start

**Three backup options ready to deploy if Railway fails you again**

---

## Files Created

```
deploy/
├── BACKUP-DEPLOYMENT.md      # Master guide (read this first)
├── oracle-cloud/
│   └── SETUP.md              # Oracle Cloud setup (PRIMARY)
├── fly-io/
│   └── SETUP.md              # Fly.io setup (SECONDARY)
└── huggingface/
    └── SETUP.md              # Hugging Face setup (EMERGENCY)

Dockerfile                     # For Fly.io & Hugging Face
fly.toml                       # Fly.io config
deploy-oracle.sh              # Oracle deploy script
deploy-fly.sh                 # Fly.io deploy script
deploy-hf.sh                  # Hugging Face deploy script
```

---

## Quick Deploy Commands

### Option 1: Oracle Cloud (Recommended Primary)

```bash
# 1. Sign up at https://cloud.oracle.com
# 2. Create VM.Standard.A1.Flex instance
# 3. SSH in and run:

ssh ubuntu@<your-ip>

# On server:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql nginx
npm install -g pnpm pm2

git clone https://github.com/Cloud99p/omnilearn-agent.git
cd omnilearn-agent
pnpm install

# Create .env with your secrets
# Then deploy:
./deploy-oracle.sh
```

**Time:** 30 minutes  
**Cost:** $0/month (free tier)  
**Resources:** 4 CPU, 24GB RAM, 200GB storage

---

### Option 2: Fly.io (Easiest)

```bash
# 1. Install Fly CLI
curl -L https://fly.io/install.sh | sh

# 2. Login
fly auth login

# 3. Deploy
./deploy-fly.sh

# 4. Set secrets
fly secrets set CLERK_SECRET_KEY=sk_test_...
fly secrets set DATABASE_URL=postgresql://...
```

**Time:** 15 minutes  
**Cost:** $0-6/month  
**Resources:** 512MB RAM, 1 CPU

---

### Option 3: Hugging Face (Emergency)

```bash
# 1. Create Space at https://huggingface.co/new-space
#    SDK: Docker, Public visibility

# 2. Add remote
git remote add hf https://huggingface.co/spaces/Emmanuel/omnilearn-agent

# 3. Deploy
./deploy-hf.sh

# 4. Set secrets in HF dashboard
```

**Time:** 10 minutes  
**Cost:** $0/month (public) or $9/month (private)  
**Resources:** 16GB RAM, 2 vCPU

---

## Which One Should You Use?

| Priority | Provider | When to Use |
|----------|----------|-------------|
| **🥇 Primary** | Oracle Cloud | Main production, most resources |
| **🥈 Secondary** | Fly.io | Quick deploy, easy rollback |
| **🥉 Emergency** | Hugging Face | Railway is down RIGHT NOW |

---

## Before You Deploy

**Checklist:**

```
□ Oracle Cloud account created (for primary)
□ Fly.io account created (for secondary)
□ Hugging Face account created (for emergency)
□ All .env variables ready:
  - DATABASE_URL
  - CLERK_SECRET_KEY
  - CLERK_PUBLISHABLE_KEY
  - PORT=3000
□ SSH key generated (for Oracle)
□ Payment method added (Fly.io requires it, even for free tier)
```

---

## After You Deploy

**Test these endpoints:**

```bash
# Health check
curl https://your-deployment-url/api/health

# Character API
curl https://your-deployment-url/api/omni/character

# Chat API
curl -X POST https://your-deployment-url/api/omni/chat \
  -H "Content-Type: application/json" \
  -d '{"content":"hey"}'
```

**All should return 200 OK** ✅

---

## If Railway Goes Down Again

**Immediate action:**

1. **Don't panic** — your code is safe on GitHub
2. **Deploy to Hugging Face** (fastest, 10 minutes)
3. **Update DNS** to point to HF temporarily
4. **Then set up Oracle Cloud** properly as permanent backup

---

## Monitoring

### Oracle Cloud
```bash
pm2 monit              # Real-time monitoring
pm2 logs omnilearn-api # View logs
```

### Fly.io
```bash
fly logs              # Real-time logs
fly dashboard         # Web dashboard
fly status            # Check status
```

### Hugging Face
```bash
# View in dashboard: Space → Settings → Logs
```

---

## Rollback

### Oracle Cloud
```bash
cd /home/ubuntu/omnilearn-agent
git revert HEAD
./deploy-oracle.sh
```

### Fly.io
```bash
fly releases list
fly rollback <version>
```

### Hugging Face
```bash
git revert <commit>
git push hf main
```

---

## Need Help?

- **Oracle Cloud:** See [`deploy/oracle-cloud/SETUP.md`](deploy/oracle-cloud/SETUP.md)
- **Fly.io:** See [`deploy/fly-io/SETUP.md`](deploy/fly-io/SETUP.md)
- **Hugging Face:** See [`deploy/huggingface/SETUP.md`](deploy/huggingface/SETUP.md)
- **All options:** See [`deploy/BACKUP-DEPLOYMENT.md`](deploy/BACKUP-DEPLOYMENT.md)

---

**Remember:** The best backup is the one you've tested. Deploy to at least one alternative BEFORE Railway fails you!

🚀 Good luck!
