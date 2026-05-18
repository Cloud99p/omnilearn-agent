# Local Development Setup

**Quick start for local development** — get OmniLearn running on your machine in 10 minutes.

---

## 🚀 Option 1: Docker Compose (Easiest)

### Prerequisites
- Docker Desktop installed
- API keys (Anthropic, Clerk)

### Setup

```bash
# 1. Clone and enter directory
git clone https://github.com/Cloud99p/omnilearn-agent.git
cd omnilearn-agent

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env with your keys
# Required:
#   - CLERK_SECRET_KEY
#   - CLERK_PUBLISHABLE_KEY
#   - ANTHROPIC_API_KEY
#   - DATABASE_URL (or use local postgres profile)

# 4. Start all services (local dev profile)
docker-compose --profile local-dev up -d

# 5. Check logs
docker-compose logs -f api-server
```

### Access

- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:8080
- **Database:** localhost:5432 (postgres:omnilearn123)

### Stop Services

```bash
docker-compose --profile local-dev down
```

---

## 🛠️ Option 2: Manual Setup (More Control)

### Prerequisites

```bash
# Node.js 20+
node --version  # Should be v20.x or higher

# pnpm
pnpm --version  # Should be 8.x or higher

# PostgreSQL 15+ (or use Supabase cloud)
psql --version
```

### Setup Steps

#### 1. Install Dependencies

```bash
pnpm install
```

#### 2. Setup Database

**Option A: Supabase (Recommended)**
```bash
# Create free project at supabase.com
# Get connection string
# Set DATABASE_URL in .env
```

**Option B: Local PostgreSQL**
```bash
# Create database
createdb omnilearn

# Set DATABASE_URL
export DATABASE_URL="postgresql://postgres:password@localhost:5432/omnilearn"

# Run migrations
cd artifacts/api-server
pnpm drizzle-kit push
```

#### 3. Import Training Data

```bash
# One-time setup
psql $DATABASE_URL < scripts/import-training-facts.sql
```

#### 4. Start Backend

```bash
cd artifacts/api-server
pnpm dev

# Server starts on http://localhost:8080
```

#### 5. Start Frontend

```bash
cd artifacts/omnilearn
pnpm dev

# Frontend starts on http://localhost:5173
```

---

## 🧪 Run Tests

```bash
# Backend tests
cd artifacts/api-server
pnpm test

# Identity detection tests
pnpm tsx scripts/test-identity-detection.ts

# Frontend tests
cd artifacts/omnilearn
pnpm test
```

---

## 📝 Common Development Tasks

### Add New Knowledge Node

```bash
cd artifacts/api-server
pnpm tsx scripts/add-knowledge-node.ts "Your fact here" --type fact --tags tag1,tag2
```

### View Conversation Logs

```bash
cd artifacts/api-server
pnpm tsx scripts/export-chat-logs.ts --output logs.json
```

### Reset Character State

```bash
cd artifacts/api-server
pnpm tsx scripts/reset-character.ts --user-id user_123
```

### Cleanup Non-Facts

```bash
cd artifacts/api-server
pnpm tsx scripts/cleanup-identity-facts.ts
```

---

## 🐛 Debugging

### Enable Debug Logging

```bash
# In .env
LOG_LEVEL=debug
DEBUG_BRAIN=true
DEBUG_TFIDF=true
```

### View Brain Processing

```bash
# Backend logs show:
[MODE] Conversation mode decision: casual
[RETRIEVAL] Found 3 relevant nodes
[SYNTHESIS] Generated response (142 chars)
```

### Database Inspection

```bash
# Connect to database
psql $DATABASE_URL

# View knowledge nodes
SELECT id, content, type, confidence FROM knowledge_nodes ORDER BY created_at DESC LIMIT 10;

# View character state
SELECT * FROM character_state LIMIT 1;

# View learning log
SELECT event, nodes_added, created_at FROM learning_log ORDER BY created_at DESC LIMIT 10;
```

---

## 🔄 Sync with Production

```bash
# Pull latest changes
git pull origin main

# Install new dependencies
pnpm install

# Run new migrations
cd artifacts/api-server
pnpm drizzle-kit push

# Restart services
docker-compose --profile local-dev restart
```

---

## 📊 Performance Tips

### Slow Responses?

```bash
# Check embedding model loading (first request is slow)
docker-compose logs api-server | grep "Embeddings module loaded"

# Subsequent requests should be <2s
```

### Database Slow?

```bash
# Analyze query performance
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM knowledge_nodes WHERE content ILIKE '%test%';"

# Add indexes if needed
```

### Memory Issues?

```bash
# Check container memory usage
docker stats omnilearn-api

# Increase memory limit in docker-compose.yml if needed
```

---

## 🆘 Troubleshooting

### "Cannot find module" errors

```bash
# Rebuild workspace
pnpm clean
pnpm install
```

### Database connection refused

```bash
# Check if postgres is running
docker-compose ps

# Verify DATABASE_URL format
echo $DATABASE_URL
```

### Clerk authentication fails

```bash
# Verify keys are correct
echo $CLERK_SECRET_KEY
echo $CLERK_PUBLISHABLE_KEY

# Check authorized URLs in Clerk dashboard
```

### Anthropic API errors

```bash
# Check API key
echo $ANTHROPIC_API_KEY

# Check rate limits at console.anthropic.com
```

---

## 🎯 Next Steps

1. **Read WHAT_WORKS_NOW.md** - Understand what's production-ready
2. **Test conversation modes** - Casual, factual, serious, emotional
3. **Add training data** - Customize for your use case
4. **Deploy to production** - Follow DEPLOYMENT-CHECKLIST.md

---

**Happy coding!** 🌑
