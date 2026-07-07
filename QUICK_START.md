# Quick Start - Testing SDK + API

## ⚡ Quick Test (5 minutes)

### Prerequisites
- Node.js 18+
- pnpm
- PostgreSQL database

### 1. Set Up Database

```bash
# Create database
createdb omnilearn_dev

# Or with Docker
docker run -d --name postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=omnilearn_dev \
  -p 5432:5432 \
  postgres:15
```

### 2. Configure Environment

```bash
cd artifacts/api-server
cat > .env << EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/omnilearn_dev
CLERK_PUBLISHABLE_KEY=pk_test_minimal
CLERK_SECRET_KEY=sk_test_minimal
NODE_ENV=development
PORT=8080
DEBUG=true
EOF
```

### 3. Install & Build

```bash
# Install dependencies
pnpm install

# Build workspace
pnpm run build

# Build network-hierarchy (required)
cd packages/network-hierarchy && pnpm run build
cd ../../artifacts/api-server
```

### 4. Start API Server

```bash
# Terminal 1
cd artifacts/api-server
pnpm run dev
```

Wait for: `Server listening on port 8080`

### 5. Test SDK

```bash
# Terminal 2
cd packages/sdk
pnpm run test:local
```

**Expected Output:**
```
🧪 OmniLearn SDK Local Test
✅ Health: { status: 'ok', ... }
✅ Record result: { success: true, nodeId: 1, ... }
✅ Search results: 1 found
✅ Stats: { totalNodes: 1, ... }
🎉 All Tests Passed!
```

---

## 🧪 Alternative: Test Without Database

If you don't have PostgreSQL set up, you can test the SDK structure:

```bash
cd packages/sdk
npx tsc --noEmit  # Type check
pnpm run build    # Build SDK
```

---

## 📝 What's Being Tested

| Test | Endpoint | What It Verifies |
|------|----------|------------------|
| Health | `GET /health` | API is running |
| Record | `POST /api/v1/knowledge/record` | Can create knowledge nodes |
| Search | `POST /api/v1/knowledge/search` | TF-IDF retrieval works |
| Batch | `POST /api/v1/knowledge/batch` | Bulk operations |
| Stats | `GET /api/v1/services/me/stats` | Service statistics |

---

## 🐛 Common Issues

### "DATABASE_URL must be set"
**Fix**: Create `.env` file with `DATABASE_URL`

### "Cannot find package @omnilearn/network-hierarchy"
**Fix**: `cd packages/network-hierarchy && pnpm run build`

### "Connection refused"
**Fix**: Make sure API server is running on port 8080

### "404 Not Found"
**Fix**: Check v1 routes are mounted in `artifacts/api-server/src/routes/index.ts`

---

## ✅ Success Checklist

- [ ] PostgreSQL running
- [ ] DATABASE_URL set in .env
- [ ] API server starts without errors
- [ ] Health check returns 200
- [ ] SDK test passes all 6 tests
- [ ] Knowledge nodes created in database

---

**Ready to test! Follow steps 1-5 above.** 🚀
