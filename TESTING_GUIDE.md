# OmniLearn SDK Testing Guide

## 🧪 Quick Start

### Option 1: Automated Test Script (Recommended)

```bash
# Terminal 1: Start API server
cd artifacts/api-server
pnpm run dev

# Terminal 2: Run SDK tests
cd packages/sdk
pnpm run test:local
```

**Expected Output:**
```
🧪 OmniLearn SDK Local Test
===========================

API URL: http://localhost:8080
Service: test-service

📋 Test 1: Health Check
------------------------
✅ Health: { status: 'ok', ... }

📝 Test 2: Record Knowledge
----------------------------
✅ Record result: { success: true, nodeId: 1, ... }

... (more tests)

🎉 All Tests Passed!
```

---

### Option 2: Manual Testing with cURL

```bash
# Start API server
cd artifacts/api-server
pnpm run dev
```

#### Test 1: Health Check
```bash
curl http://localhost:8080/health
```

**Expected:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 123,
  "timestamp": "2026-07-07T14:00:00.000Z"
}
```

#### Test 2: Record Knowledge
```bash
curl -X POST http://localhost:8080/api/v1/knowledge/record \
  -H "Content-Type: application/json" \
  -d '{
    "type": "test_event",
    "data": {
      "eventId": "test-001",
      "status": "success",
      "message": "Hello World"
    }
  }'
```

**Expected:**
```json
{
  "success": true,
  "nodeId": 1,
  "hash": "a1b2c3d4",
  "timestamp": "2026-07-07T14:00:00.000Z"
}
```

#### Test 3: Search Knowledge
```bash
curl -X POST http://localhost:8080/api/v1/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test event",
    "limit": 10
  }'
```

**Expected:**
```json
{
  "success": true,
  "results": [...],
  "total": 1,
  "query": "test event"
}
```

#### Test 4: Batch Record
```bash
curl -X POST http://localhost:8080/api/v1/knowledge/batch \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {"type": "event", "data": {"id": 1}},
      {"type": "event", "data": {"id": 2}}
    ]
  }'
```

**Expected:**
```json
{
  "success": true,
  "recorded": 2,
  "failed": 0,
  "nodeIds": [1, 2]
}
```

#### Test 5: Get Stats
```bash
curl "http://localhost:8080/api/v1/services/me/stats?serviceName=test-service"
```

**Expected:**
```json
{
  "success": true,
  "stats": {
    "totalNodes": 3,
    "totalEdges": 0,
    "totalRecords": 0,
    "nodesByType": [...],
    "serviceInfo": {
      "name": "test-service",
      "version": "1.0.0",
      "domain": "general"
    }
  }
}
```

---

### Option 3: Test with Your Own Code

```typescript
import { OmniLearnClient } from '@cloud99p/omnilearn-sdk';

const client = new OmniLearnClient({
  apiKey: 'test-key',
  apiBaseUrl: 'http://localhost:8080',
  serviceName: 'my-app',
});

// Record
await client.record({
  type: 'user_action',
  data: { userId: '123', action: 'login' },
});

// Search
const results = await client.search({
  query: 'user login',
  limit: 10,
});

console.log('Results:', results);
```

---

## 🔧 Troubleshooting

### Error: Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:8080
```

**Solution:**
1. Make sure API server is running
2. Check port: `lsof -i :8080`
3. Restart: `cd artifacts/api-server && pnpm run dev`

---

### Error: 404 Not Found
```
Error: Request failed with status code 404
```

**Solution:**
1. Verify endpoint path (should be `/api/v1/knowledge/record`)
2. Check API server logs for mounted routes
3. Ensure v1 routes are registered in `artifacts/api-server/src/routes/index.ts`

---

### Error: Database Connection Failed
```
Error: connect ECONNREFUSED (database)
```

**Solution:**
1. Check DATABASE_URL environment variable
2. Ensure PostgreSQL is running
3. Run migrations: `cd lib/db && pnpm run migrate`

---

### Error: TypeScript Compilation Failed
```
error TS2304: Cannot find name 'OmniLearnClient'
```

**Solution:**
1. Build SDK first: `cd packages/sdk && pnpm run build`
2. Or use tsx: `npx tsx test-local.ts`

---

## 📊 Test Checklist

- [ ] API server starts without errors
- [ ] Health check returns 200 OK
- [ ] Record knowledge creates node in database
- [ ] Search returns relevant results
- [ ] Batch record processes multiple items
- [ ] Stats endpoint returns correct counts
- [ ] SDK methods map to correct endpoints
- [ ] Error handling works (invalid requests)
- [ ] Authentication works (if enabled)

---

## 🎯 Success Criteria

✅ **All tests pass** - No errors in test output  
✅ **Database populated** - Knowledge nodes created  
✅ **Search works** - TF-IDF retrieval returns results  
✅ **SDK compatible** - All SDK methods work with API  

---

## 🚀 Next Steps After Testing

1. **Fix any issues** - Update API or SDK as needed
2. **Add more tests** - Edge cases, error scenarios
3. **Write unit tests** - Vitest tests for SDK methods
4. **Integration tests** - Full end-to-end testing
5. **Deploy to staging** - Test in production-like environment

---

## 📝 Environment Variables

```bash
# API Server (.env in artifacts/api-server/)
DATABASE_URL=postgresql://user:pass@localhost:5432/omnilearn
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NODE_ENV=development
PORT=8080

# SDK Test (optional)
API_BASE_URL=http://localhost:8080
SERVICE_NAME=test-service
```

---

**Ready to test! Run `pnpm run test:local` in packages/sdk/** 🧪
