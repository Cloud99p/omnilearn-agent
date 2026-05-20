# Fly.io Backup Setup Guide

**Secondary Backup** — Railway-like UX, 3 free VMs, global edge

---

## Step 1: Sign Up

1. Go to https://fly.io
2. Click "Get Started"
3. Sign up with GitHub (recommended) or email
4. Add payment method (required, but free tier won't charge)
5. Install Fly CLI:

```bash
curl -L https://fly.io/install.sh | sh
```

---

## Step 2: Login

```bash
fly auth login
```

---

## Step 3: Create fly.toml

Create `fly.toml` in your repo root:

```toml
app = "omnilearn-agent"
primary_region = "ams"  # Amsterdam (closest to Nigeria)

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "3000"
  NODE_ENV = "production"
  CLERK_SECRET_KEY = "sk_test_..."
  CLERK_PUBLISHABLE_KEY = "pk_test_..."
  DATABASE_URL = "postgresql://user:pass@db-host:5432/omnilearn"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

  [http_service.concurrency]
    hard_limit = 25
    soft_limit = 20
    type = "connections"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512

[[mounts]]
  source = "omnilearn_data"
  destination = "/data"
  initial_size = "3gb"
```

---

## Step 4: Create Dockerfile

Create `Dockerfile` in repo root:

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

# Expose port
EXPOSE 3000

# Start server
CMD ["pnpm", "start"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
```

---

## Step 5: Create Database

Fly.io doesn't include PostgreSQL, so use **Supabase** (you're already using it) or **Neon**:

### Option A: Supabase (Recommended)
- You're already using Supabase
- Just use the same connection string
- No setup needed

### Option B: Fly.io Postgres
```bash
# Create Postgres cluster on Fly.io
fly postgres create --name omnilearn-db

# Attach to your app
fly postgres attach --app omnilearn-agent omnilearn-db
```

---

## Step 6: Set Secrets

```bash
# Set environment variables as secrets
fly secrets set CLERK_SECRET_KEY=sk_test_...
fly secrets set CLERK_PUBLISHABLE_KEY=pk_test_...
fly secrets set DATABASE_URL=postgresql://...
```

---

## Step 7: Deploy

```bash
# Initialize app (first time only)
fly launch --no-deploy

# Deploy
fly deploy

# View logs
fly logs

# View status
fly status

# Open in browser
fly open
```

---

## Step 8: Deploy Script (For Future Updates)

Create `deploy-fly.sh`:

```bash
#!/bin/bash
# deploy-fly.sh - Deploy to Fly.io

set -e

echo "🚀 Deploying to Fly.io..."

# Ensure we're on main branch
git checkout main
git pull origin main

# Deploy
fly deploy --remote-only

# Show status
fly status

# Show recent logs
fly logs --recent

echo "✅ Deployment complete!"
```

Make it executable:
```bash
chmod +x deploy-fly.sh
```

---

## Monitoring & Management

```bash
# View real-time logs
fly logs

# View app status
fly status

# View deployed instances
fly machines list

# Restart app
fly restart

# SSH into instance
fly ssh console

# View metrics
fly dashboard

# Scale up (if needed)
fly scale count 2

# Rollback to previous deployment
fly deploy --image registry.fly.io/omnilearn-agent:deployment-<version>
```

---

## Cost Breakdown

| Resource | Free Tier | Paid |
|----------|-----------|------|
| 3 shared VMs (256MB) | FREE | $1.94/month each |
| 3GB storage | FREE | $0.15/GB/month |
| Data transfer | 160GB/month free | $0.02/GB after |
| **Typical Cost** | **$0/month** | **~$6-10/month** |

---

## Custom Domain

```bash
# Add custom domain
fly certs add your-domain.com

# Add DNS records
fly certs show your-domain.com
# Add the AAAA and A records it shows to your DNS
```

---

## Troubleshooting

### Build Fails
```bash
# View build logs
fly logs --recent

# Build locally to test
docker build -t omnilearn-agent .
```

### App Crashes on Start
```bash
# View logs
fly logs

# SSH in and debug
fly ssh console

# Check environment variables
fly secrets list
```

### Database Connection Fails
```bash
# Test connection from local machine
psql <DATABASE_URL>

# If using Supabase, check connection pooler settings
# If using Fly Postgres, ensure it's attached
fly postgres attach --app omnilearn-agent omnilearn-db
```

### High Memory Usage
```bash
# View memory usage
fly dashboard

# Reduce concurrency in fly.toml
# Or upgrade to paid VM:
fly scale vm shared-cpu-2x
```

---

## Quick Rollback

```bash
# List previous deployments
fly releases list

# Rollback to specific version
fly rollback <version>
```

---

**Next Step:** Create the files above, then run `fly deploy`!
