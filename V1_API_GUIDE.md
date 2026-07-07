# OmniLearn V1 API Guide

**Base URL**: `http://localhost:8080` (development) or your deployed URL

---

## 🎯 Overview

The V1 API provides endpoints that match the `@cloud99p/omnilearn-sdk` interface. These endpoints are designed for SDK-first architecture.

---

## 📡 Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 12345,
  "timestamp": "2026-07-07T14:00:00.000Z"
}
```

---

### Record Knowledge

```http
POST /api/v1/knowledge/record
Content-Type: application/json
```

**Request:**
```json
{
  "type": "event_completed",
  "data": {
    "eventId": "123",
    "status": "success",
    "timestamp": "2026-07-07T14:00:00.000Z"
  },
  "metadata": {
    "serviceVersion": "1.0.0"
  }
}
```

**Response:**
```json
{
  "success": true,
  "nodeId": 42,
  "hash": "a1b2c3d4",
  "timestamp": "2026-07-07T14:00:00.000Z"
}
```

**Status Codes:**
- `201` - Success
- `400` - Invalid request
- `500` - Server error

---

### Search Knowledge

```http
POST /api/v1/knowledge/search
Content-Type: application/json
```

**Request:**
```json
{
  "query": "successful events",
  "limit": 20,
  "offset": 0,
  "type": "event_completed",
  "timeRange": {
    "start": "2026-07-01T00:00:00.000Z",
    "end": "2026-07-07T23:59:59.000Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": 42,
      "type": "event_completed",
      "data": {
        "eventId": "123",
        "status": "success"
      },
      "metadata": {},
      "similarity": 0.85
    }
  ],
  "total": 1,
  "query": "successful events"
}
```

---

### Batch Record

```http
POST /api/v1/knowledge/batch
Content-Type: application/json
```

**Request:**
```json
{
  "records": [
    {
      "type": "event_completed",
      "data": { "eventId": "123", "status": "success" }
    },
    {
      "type": "user_action",
      "data": { "userId": "456", "action": "login" }
    }
  ],
  "metadata": {
    "serviceVersion": "1.0.0"
  }
}
```

**Response:**
```json
{
  "success": true,
  "recorded": 2,
  "failed": 0,
  "nodeIds": [42, 43]
}
```

**Limits:**
- Maximum 100 records per batch

---

### Get Service Stats

```http
GET /api/v1/services/me/stats
```

**Query Parameters:**
- `serviceName` (optional) - Service name
- `serviceVersion` (optional) - Service version

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalNodes": 150,
    "totalEdges": 0,
    "totalRecords": 0,
    "nodesByType": [
      { "type": "event_completed", "count": 50 },
      { "type": "user_action", "count": 100 }
    ],
    "recentActivity": [],
    "serviceInfo": {
      "name": "my-service",
      "version": "1.0.0",
      "domain": "general"
    }
  }
}
```

---

### Get Service Info

```http
GET /api/v1/services/me
```

**Response:**
```json
{
  "success": true,
  "service": {
    "name": "my-service",
    "version": "1.0.0",
    "domain": "general",
    "registeredAt": "2026-07-07T14:00:00.000Z",
    "status": "active"
  }
}
```

---

## 🔐 Authentication

All endpoints support optional authentication via Clerk:

- **Authenticated**: Knowledge is associated with user's `clerkId`
- **Anonymous**: Knowledge is stored globally (`clerkId` is NULL)

### Headers (Optional)
```
Authorization: Bearer <clerk_token>
```

---

## 🧪 Testing with cURL

### Health Check
```bash
curl http://localhost:8080/health
```

### Record Knowledge
```bash
curl -X POST http://localhost:8080/api/v1/knowledge/record \
  -H "Content-Type: application/json" \
  -d '{
    "type": "test_event",
    "data": { "message": "Hello World" }
  }'
```

### Search Knowledge
```bash
curl -X POST http://localhost:8080/api/v1/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Hello World",
    "limit": 10
  }'
```

### Get Stats
```bash
curl http://localhost:8080/api/v1/services/me/stats?serviceName=test-service
```

---

## 📦 SDK Usage

The SDK automatically uses these endpoints:

```typescript
import { OmniLearnClient } from '@cloud99p/omnilearn-sdk';

const client = new OmniLearnClient({
  apiKey: 'omni_sk_xxx',
  apiBaseUrl: 'http://localhost:8080',
  serviceName: 'my-service',
});

// Record knowledge
await client.record({
  type: 'event_completed',
  data: { eventId: '123', status: 'success' },
});

// Search knowledge
const results = await client.search({
  query: 'successful events',
  limit: 10,
});

// Get stats
const stats = await client.getStats();

// Health check
const health = await client.health();
```

---

## 🏗️ Architecture

```
┌─────────────────┐
│  OmniLearn SDK  │
│  (@cloud99p/    │
│   omnilearn-sdk)│
└────────┬────────┘
         │ HTTP/REST
         ▼
┌─────────────────┐
│   V1 API Layer  │
│  /api/v1/*      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Database       │
│  (PostgreSQL)   │
│  - knowledge_   │
│    nodes        │
│  - knowledge_   │
│    edges        │
└─────────────────┘
```

---

## 📝 Notes

1. **Backward Compatibility**: Existing `/api/omni/knowledge` endpoints remain unchanged
2. **Schema**: Uses existing `knowledge_nodes` table
3. **TF-IDF**: Search uses TF-IDF vector retrieval for semantic search
4. **Rate Limiting**: V1 endpoints use default rate limiters (100 req/15min)

---

## 🚀 Deployment

### Local Development
```bash
cd artifacts/api-server
pnpm run dev
```

### Production
```bash
pnpm run build
pnpm run start
```

### Environment Variables
```bash
DATABASE_URL=postgresql://...
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NODE_ENV=production
PORT=8080
```

---

## 🔗 Related

- [SDK Documentation](packages/sdk/README.md)
- [GitHub Packages](https://github.com/Cloud99p/omnilearn-agent/pkgs/npm/omnilearn-sdk)
- [API Server](artifacts/api-server/)

---

**API Version**: 1.0.0  
**Last Updated**: 2026-07-07
