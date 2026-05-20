# Hugging Face Spaces Setup Guide

**Emergency Backup** — 16GB RAM, 2 vCPU, Docker-based, AI-focused

---

## Step 1: Sign Up

1. Go to https://huggingface.co
2. Click "Sign Up"
3. Sign up with GitHub (recommended) or email
4. Verify email

---

## Step 2: Create Space

1. Go to https://huggingface.co/new-space
2. **Configuration:**
   - **Owner:** Your username
   - **Space name:** `omnilearn-agent`
   - **License:** MIT
   - **SDK:** Docker
   - **Visibility:** Public (free) or Private ($9/month)

3. Click "Create Space"

---

## Step 3: Create Dockerfile

Create `Dockerfile` in repo root (same as Fly.io):

```dockerfile
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files first (for better caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY packages/network-hierarchy/package.json ./packages/network-hierarchy/
COPY lib/db/package.json ./lib/db/
COPY lib/integrations/anthropic-ai/package.json ./lib/integrations/anthropic-ai/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy rest of code
COPY . .

# Build if needed
RUN cd artifacts/api-server && pnpm build || true

# Set working directory
WORKDIR /app/artifacts/api-server

# Expose port (HF auto-detects)
EXPOSE 3000

# Start server
CMD ["pnpm", "start"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
```

---

## Step 4: Create README

Create `README.md` in repo root (required for HF Spaces):

```markdown
---
title: OmniLearn Agent
emoji: 🤖
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
license: mit
---

# OmniLearn Agent

AI agent with persistent memory and evolving personality.

## Features

- Knowledge graph with TF-IDF retrieval
- 7 evolving personality traits
- Conversation mode detection
- Content moderation
- Web search integration

## API

- `GET /api/omni/character` - Get character state
- `POST /api/omni/chat` - Chat with Omni
- `GET /api/omni/knowledge/stats` - Knowledge graph stats

## Built by

Emmanuel Nenpan Hosea

## License

MIT
```

---

## Step 5: Push to Hugging Face

```bash
# Add Hugging Face remote
git remote add hf https://huggingface.co/spaces/Emmanuel/omnilearn-agent

# Or with GitHub-style URL
git remote add hf https://<your-username>@huggingface.co/spaces/<your-username>/omnilearn-agent

# Push code
git push hf main
```

**Alternative: Use HF Git Credential Helper**

```bash
# Install HF CLI
pip install huggingface_hub

# Login
huggingface-cli login

# Add remote and push
git remote add hf https://huggingface.co/spaces/Emmanuel/omnilearn-agent
git push hf main
```

---

## Step 6: Set Environment Variables

1. Go to your Space: https://huggingface.co/spaces/Emmanuel/omnilearn-agent
2. Click "Settings" tab
3. Scroll to "Variables and secrets"
4. Add secrets:
   - `CLERK_SECRET_KEY` = `sk_test_...`
   - `CLERK_PUBLISHABLE_KEY` = `pk_test_...`
   - `DATABASE_URL` = `postgresql://...`
   - `PORT` = `3000`

5. Click "Save"
6. Space will auto-redeploy

---

## Step 7: Deploy Script (For Future Updates)

Create `deploy-hf.sh`:

```bash
#!/bin/bash
# deploy-hf.sh - Deploy to Hugging Face Spaces

set -e

echo "🚀 Deploying to Hugging Face Spaces..."

# Ensure we're on main branch
git checkout main
git pull origin main

# Push to HF
git push hf main

# Show Space URL
echo ""
echo "✅ Deployment complete!"
echo "🌐 View at: https://huggingface.co/spaces/Emmanuel/omnilearn-agent"
echo "📊 Monitor at: https://huggingface.co/spaces/Emmanuel/omnilearn-agent/tree/main"
```

Make it executable:
```bash
chmod +x deploy-hf.sh
```

---

## Monitoring & Management

```bash
# View logs (in HF dashboard)
# Go to Space → Settings → Logs

# Restart Space (in HF dashboard)
# Go to Space → Settings → Factory reboot

# Pause Space (to save resources)
# Go to Space → Settings → Pause Space

# Resume Space
# Go to Space → Settings → Resume Space
```

---

## Cost Breakdown

| Resource | Free Tier | Paid |
|----------|-----------|------|
| Docker container (16GB RAM, 2 vCPU) | FREE (public) | $9/month (private) |
| Storage | 10GB free | $9/month for more |
| Data transfer | Unlimited | Unlimited |
| Custom domain | FREE | FREE |
| **Typical Cost** | **$0/month** | **$9/month** (private) |

---

## Custom Domain

1. Go to Space Settings
2. Scroll to "Custom domains"
3. Click "Add custom domain"
4. Enter your domain
5. Add CNAME record to your DNS:
   ```
   your-domain.com CNAME hf.space
   ```
6. HF auto-provisions SSL

---

## Troubleshooting

### Build Fails
```bash
# Check build logs in HF dashboard
# Space → Settings → Logs

# Test Docker build locally
docker build -t omnilearn-agent .
```

### Container Crashes
```bash
# View runtime logs
# Space → Settings → Logs

# Check environment variables are set
# Space → Settings → Variables and secrets
```

### Space is "Building" Forever
```bash
# Factory reboot
# Space → Settings → Factory reboot

# Or pause and resume
# Space → Settings → Pause Space
# Wait 10 seconds
# Space → Settings → Resume Space
```

### Out of Memory
```bash
# Free tier gets 16GB RAM - should be plenty
# If still OOM, optimize your code or add swap:

# In Dockerfile, add before CMD:
RUN dd if=/dev/zero of=/swapfile bs=1M count=2048 && \
    chmod 600 /swapfile && \
    mkswap /swapfile && \
    swapon /swapfile
```

---

## Quick Rollback

```bash
# View commit history
git log hf/main

# Revert to specific commit
git revert <commit-hash>
git push hf main

# Or force push to specific commit
git checkout <commit-hash>
git push hf main --force
git checkout main
```

---

## API Endpoint

Your API will be available at:

```
https://huggingface.co/spaces/Emmanuel/omnilearn-agent/api/omni/character
```

Or with custom domain:

```
https://your-domain.com/api/omni/character
```

---

**Next Step:** Create Space, push code, set secrets, test!
