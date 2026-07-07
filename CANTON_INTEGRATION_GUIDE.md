# Canton RWA Integration Guide

**Standalone project in the OmniLearn ecosystem**

This guide shows how to integrate Canton Network (RWA tokenization platform) with OmniLearn as a standalone service.

---

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CANTON NETWORK                            │
│  (Standalone Repository: @cloud99p/canton-rwa)              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Canton Application Layer                           │   │
│  │  - Asset Issuance                                   │   │
│  │  - Trade Execution                                  │   │
│  │  - Treasury Management                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  OmniLearn SDK Client                               │   │
│  │  import { OmniLearnClient } from '@omnilearn/sdk'  │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  OmniLearn Knowledge Layer                          │   │
│  │  - Knowledge Recording                              │   │
│  │  - Semantic Search                                  │   │
│  │  - Cross-Domain Queries                             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              https://api.omnilearn.ai
```

**Key Principle**: Canton remains a standalone project with its own:
- Versioning
- Codebase
- Deployment
- Community
- Roadmap

But it integrates with OmniLearn for:
- Cross-service intelligence
- Pattern recognition
- Historical insights
- Multi-domain analysis

---

## 📦 Repository Structure

### Canton-RWA Repository (Standalone)

```
canton-rwa/
├── packages/
│   ├── canton-app/           # Canton application logic
│   ├── canton-api/           # Canton API layer
│   └── canton-sdk/           # Canton SDK for developers
├── integrations/
│   └── omnilearn/            # OmniLearn integration
│       ├── client.ts         # OmniLearn client wrapper
│       ├── schemas.ts        # Knowledge schemas
│       └── recorder.ts       # Knowledge recording logic
├── src/
│   ├── assets/               # Asset issuance
│   ├── trades/               # Trade execution
│   └── treasury/             # Treasury management
├── tests/
├── package.json
├── README.md
└── .env
```

### OmniLearn SDK Repository (Shared)

```
omnilearn-agent/
└── packages/
    └── sdk/                  # @omnilearn/sdk
        ├── src/
        │   ├── index.ts
        │   ├── client.ts
        │   └── types.ts
        ├── examples/
        └── README.md
```

---

## 🚀 Quick Start: Canton + OmniLearn

### Step 1: Set Up Canton Repository

```bash
# Clone Canton RWA repository
git clone https://github.com/Cloud99p/canton-rwa.git
cd canton-rwa

# Install dependencies
pnpm install

# Set environment variables
cp .env.example .env
# Edit .env with your Canton configuration
```

### Step 2: Install OmniLearn SDK

```bash
# From within canton-rwa repository
pnpm add @omnilearn/sdk
```

### Step 3: Configure OmniLearn Integration

```typescript
// integrations/omnilearn/client.ts

import { OmniLearnClient } from '@omnilearn/sdk';

export const omnilearnClient = new OmniLearnClient({
  apiKey: process.env.OMNILEARN_API_KEY!,
  apiBaseUrl: process.env.OMNILEARN_API_URL || 'https://api.omnilearn.ai',
  serviceName: 'canton-rwa',
  serviceVersion: process.env.npm_package_version || '1.0.0',
  domain: 'blockchain',
  enableLogging: process.env.NODE_ENV === 'development',
});
```

### Step 4: Define Knowledge Schemas

```typescript
// integrations/omnilearn/schemas.ts

import { OmniLearnClient } from '@omnilearn/sdk';

export async function registerCantonSchemas(client: OmniLearnClient) {
  // Asset Issuance Schema
  await client.registerSchema({
    typeName: 'asset_issued',
    domain: 'blockchain',
    schema: {
      type: 'object',
      required: ['assetId', 'assetType', 'totalValue', 'issuer'],
      properties: {
        assetId: { type: 'string' },
        assetType: {
          type: 'string',
          enum: ['treasury-bond', 'corporate-bond', 'equity', 'real-estate'],
        },
        totalValue: { type: 'number', minimum: 0 },
        currency: { type: 'string', default: 'USD' },
        issuer: { type: 'string' },
        jurisdiction: { type: 'string' },
      },
    },
  });

  // Trade Execution Schema
  await client.registerSchema({
    typeName: 'trade_executed',
    domain: 'blockchain',
    schema: {
      type: 'object',
      required: ['tradeId', 'assetId', 'price', 'quantity'],
      properties: {
        tradeId: { type: 'string' },
        assetId: { type: 'string' },
        price: { type: 'number' },
        quantity: { type: 'number' },
        side: { type: 'string', enum: ['buy', 'sell'] },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  });

  // Bundle Submission Schema
  await client.registerSchema({
    typeName: 'bundle_submitted',
    domain: 'blockchain',
    schema: {
      type: 'object',
      required: ['bundleId', 'success'],
      properties: {
        bundleId: { type: 'string' },
        success: { type: 'boolean' },
        tip: { type: 'number' },
        latency: { type: 'number' },
        failureReason: { type: 'string' },
      },
    },
  });

  // Treasury Operation Schema
  await client.registerSchema({
    typeName: 'treasury_operation',
    domain: 'blockchain',
    schema: {
      type: 'object',
      required: ['operationId', 'type', 'amount'],
      properties: {
        operationId: { type: 'string' },
        type: {
          type: 'string',
          enum: ['rebalance', 'distribution', 'collection'],
        },
        amount: { type: 'number' },
        assetId: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  });
}
```

### Step 5: Record Knowledge in Business Logic

```typescript
// src/assets/issue.ts

import { omnilearnClient } from '../../integrations/omnilearn/client';

export async function issueAsset(params: IssueAssetParams) {
  // 1. Execute Canton business logic
  const asset = await cantonClient.issueAsset(params);

  // 2. Record to OmniLearn (non-blocking)
  await omnilearnClient.record({
    type: 'asset_issued',
    data: {
      assetId: asset.id,
      assetType: asset.type,
      totalValue: asset.totalValue,
      currency: asset.currency,
      issuer: asset.issuer,
      jurisdiction: asset.jurisdiction,
    },
    metadata: {
      userId: params.userId,
      sessionId: params.sessionId,
    },
  });

  // 3. Return asset to caller
  return asset;
}
```

```typescript
// src/trades/execute.ts

import { omnilearnClient } from '../../integrations/omnilearn/client';

export async function executeTrade(params: ExecuteTradeParams) {
  // 1. Execute trade
  const trade = await cantonClient.executeTrade(params);

  // 2. Record trade execution
  await omnilearnClient.recordAndWait({
    type: 'trade_executed',
    data: {
      tradeId: trade.id,
      assetId: trade.assetId,
      price: trade.price,
      quantity: trade.quantity,
      side: trade.side,
      timestamp: new Date().toISOString(),
    },
  });

  return trade;
}
```

---

## 📊 Knowledge Recording Patterns

### Pattern 1: Fire-and-Forget (Fast)

Use when you need speed and don't need immediate confirmation.

```typescript
// Record asset issuance (fire-and-forget)
await omnilearnClient.record({
  type: 'asset_issued',
  data: { assetId, assetType, totalValue, issuer },
});
```

### Pattern 2: With Acknowledgment (Reliable)

Use when you need the node ID for audit trails.

```typescript
// Record trade with acknowledgment
const response = await omnilearnClient.recordAndWait({
  type: 'trade_executed',
  data: { tradeId, price, quantity },
});

// Store node ID in your database
await db.trades.update(tradeId, { omnilearnNodeId: response.nodeId });
```

### Pattern 3: Batch Recording (Efficient)

Use when recording multiple events in a single transaction.

```typescript
// Batch record multiple events
await omnilearnClient.recordBatch({
  records: [
    { type: 'asset_issued', data: { ... } },
    { type: 'trade_executed', data: { ... } },
    { type: 'treasury_operation', data: { ... } },
  ],
});
```

### Pattern 4: Error Handling (Robust)

Use when recording is critical to your business logic.

```typescript
// Record with error handling
async function safeRecord(params: RecordParams) {
  try {
    await omnilearnClient.record(params);
    console.log('✅ Knowledge recorded');
  } catch (error) {
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      // Queue for retry later
      await queueForRetry(params);
    } else {
      // Log error but don't fail business logic
      console.error('❌ OmniLearn recording failed:', error);
    }
  }
}
```

---

## 🔍 Querying Insights

### Cross-Service Analysis

```typescript
// Get insights from multiple services
const insights = await omnilearnClient.search({
  query: 'treasury bond performance trends',
  sources: ['canton-rwa', 'agentflow', 'dex-swap'],
  types: ['asset_issued', 'trade_executed'],
  limit: 20,
});

// Analyze patterns
insights.nodes.forEach(node => {
  console.log(`${node.source}:`, node.data);
});
```

### Historical Pattern Recognition

```typescript
// Find patterns in past asset issuances
const patterns = await omnilearnClient.search({
  query: 'successful treasury bond issuances',
  types: ['asset_issued'],
  timeRange: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
  },
  limit: 50,
});

// Extract success factors
const successFactors = patterns.nodes
  .filter(node => node.data.totalValue > 1000000)
  .map(node => node.data.issuer);
```

### Real-Time Monitoring

```typescript
// Stream real-time trade executions
const stream = omnilearnClient.stream({
  types: ['trade_executed'],
  sources: ['canton-rwa'],
});

for await (const event of stream) {
  const trade = event.data as KnowledgeNode;
  console.log(`New trade: ${trade.data.tradeId} at $${trade.data.price}`);
  
  // Trigger alerts for large trades
  if (trade.data.quantity > 1000000) {
    await sendAlert(`Large trade detected: ${trade.data.tradeId}`);
  }
}
```

---

## 🏗️ Deployment Guide

### Canton-RWA Deployment

```yaml
# docker-compose.yml
version: '3.8'

services:
  canton-app:
    build: .
    environment:
      - OMNILEARN_API_KEY=${OMNILEARN_API_KEY}
      - OMNILEARN_API_URL=https://api.omnilearn.ai
    depends_on:
      - omnilearn-healthcheck

  omnilearn-healthcheck:
    image: curlimages/curl
    command: curl -f http://api.omnilearn.ai/health || exit 1
    restart: "no"
```

### Environment Variables

```bash
# Canton-RWA .env
CANTON_RPC_URL=https://rpc.canton.network
CANTON_NETWORK_ID=mainnet

# OmniLearn Integration
OMNILEARN_API_KEY=omni_sk_your_key_here
OMNILEARN_API_URL=https://api.omnilearn.ai
OMNILEARN_ENABLE_LOGGING=false
```

### Health Checks

```typescript
// src/health.ts

import { omnilearnClient } from './integrations/omnilearn/client';

export async function checkOmniLearnHealth() {
  try {
    const health = await omnilearnClient.health();
    
    if (health.status !== 'healthy') {
      console.warn('⚠️  OmniLearn API is not healthy:', health.status);
      return false;
    }
    
    console.log('✅ OmniLearn API is healthy');
    return true;
  } catch (error) {
    console.error('❌ OmniLearn health check failed:', error);
    return false;
  }
}
```

---

## 📈 Monitoring & Analytics

### Service Statistics

```typescript
// Monitor your Canton service
const stats = await omnilearnClient.getStats();

console.log('Canton-RWA OmniLearn Stats:');
console.log(`  Nodes Recorded: ${stats.nodesRecorded}`);
console.log(`  Edges Created: ${stats.edgesCreated}`);
console.log(`  API Calls Today: ${stats.apiCallsToday}`);
console.log(`  Rate Limit Remaining: ${stats.rateLimitRemaining}`);
```

### Custom Dashboard

```typescript
// Get insights for dashboard
const dashboardData = await omnilearnClient.search({
  query: 'daily trading volume',
  types: ['trade_executed'],
  timeRange: {
    start: new Date().toISOString(),
    end: new Date().toISOString(),
  },
  limit: 100,
});

const totalVolume = dashboardData.nodes.reduce(
  (sum, node) => sum + (node.data.quantity || 0),
  0
);

console.log(`Daily Volume: $${totalVolume}`);
```

---

## 🔒 Security Best Practices

### 1. API Key Management

```bash
# NEVER commit API keys to git
# Use environment variables only

# .gitignore
*.env
.env.local
.env.production

# .env.production (on server only)
OMNILEARN_API_KEY=omni_sk_***
```

### 2. Service Isolation

```typescript
// Each service gets its own API key
// Keys are scoped to specific service name

const cantonClient = new OmniLearnClient({
  apiKey: process.env.CANTON_OMNILEARN_KEY!, // Separate from other services
  serviceName: 'canton-rwa', // Unique identifier
});

const dexClient = new OmniLearnClient({
  apiKey: process.env.DEX_OMNILEARN_KEY!, // Separate key
  serviceName: 'dex-swap', // Different service
});
```

### 3. Rate Limiting

```typescript
// Implement client-side rate limiting
import rateLimit from 'express-rate-limit';

const omnilearnLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute
  message: 'Rate limit exceeded',
  handler: (req, res) => {
    res.status(429).json({ error: 'Rate limit exceeded' });
  },
});

app.use('/api/knowledge', omnilearnLimiter);
```

### 4. Data Validation

```typescript
// Validate data before recording
import { Ajv } from 'ajv';

const ajv = new Ajv();

function validateRecord(params: RecordParams) {
  const schema = getRegisteredSchema(params.type);
  const validate = ajv.compile(schema);
  
  if (!validate(params.data)) {
    throw new Error(`Invalid data: ${validate.errors}`);
  }
  
  return true;
}

async function safeRecord(params: RecordParams) {
  validateRecord(params); // Validate first
  await omnilearnClient.record(params); // Then record
}
```

---

## 🧪 Testing

### Unit Tests

```typescript
// tests/omnilearn.test.ts

import { OmniLearnClient } from '@omnilearn/sdk';

describe('OmniLearn Integration', () => {
  let client: OmniLearnClient;
  
  beforeAll(() => {
    client = new OmniLearnClient({
      apiKey: 'test_key',
      apiBaseUrl: 'http://localhost:3000',
      serviceName: 'canton-test',
      enableLogging: true,
    });
  });
  
  test('should record knowledge successfully', async () => {
    await expect(
      client.record({
        type: 'test_event',
        data: { test: 'data' },
      })
    ).resolves.toBeUndefined();
  });
  
  test('should search knowledge', async () => {
    const results = await client.search({
      query: 'test',
      limit: 10,
    });
    
    expect(results).toHaveProperty('nodes');
    expect(results).toHaveProperty('total');
  });
});
```

### Integration Tests

```typescript
// tests/integration/canton-omnilearn.test.ts

import { cantonClient } from '../../src/canton';
import { omnilearnClient } from '../../integrations/omnilearn/client';

describe('Canton + OmniLearn Integration', () => {
  beforeEach(async () => {
    // Reset test data
    await omnilearnClient.deleteAllTestNodes();
  });
  
  test('should record asset issuance to OmniLearn', async () => {
    // Issue asset
    const asset = await cantonClient.issueAsset({
      type: 'treasury-bond',
      value: 1000000,
    });
    
    // Verify recorded in OmniLearn
    const results = await omnilearnClient.search({
      query: `asset ${asset.id}`,
      limit: 1,
    });
    
    expect(results.nodes.length).toBe(1);
    expect(results.nodes[0].data.assetId).toBe(asset.id);
  });
});
```

---

## 📊 Performance Optimization

### 1. Batch Recording

```typescript
// Instead of individual calls
await omnilearnClient.record({ type: 'event_1', data: {...} });
await omnilearnClient.record({ type: 'event_2', data: {...} });
await omnilearnClient.record({ type: 'event_3', data: {...} });

// Use batch
await omnilearnClient.recordBatch({
  records: [
    { type: 'event_1', data: {...} },
    { type: 'event_2', data: {...} },
    { type: 'event_3', data: {...} },
  ],
});
```

### 2. Connection Pooling

```typescript
// Reuse client instance
const omnilearn = new OmniLearnClient({...});

// Good: Reuse client
async function handler1() {
  await omnilearn.record({...});
}

async function handler2() {
  await omnilearn.search({...});
}

// Bad: Create new client each time
async function handler1() {
  const client = new OmniLearnClient({...}); // New connection
  await client.record({...});
}
```

### 3. Caching

```typescript
// Cache frequently queried data
import LRUCache from 'lru-cache';

const knowledgeCache = new LRUCache({
  max: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
});

async function getCachedKnowledge(query: string) {
  const cached = knowledgeCache.get(query);
  if (cached) return cached;
  
  const results = await omnilearnClient.search({ query });
  knowledgeCache.set(query, results);
  
  return results;
}
```

---

## 🔄 Migration Guide

### From No OmniLearn to With OmniLearn

1. **Install SDK**
   ```bash
   pnpm add @omnilearn/sdk
   ```

2. **Initialize Client**
   ```typescript
   import { OmniLearnClient } from '@omnilearn/sdk';
   
   const omnilearn = new OmniLearnClient({
     apiKey: process.env.OMNILEARN_API_KEY,
     serviceName: 'canton-rwa',
   });
   ```

3. **Add Recording Calls**
   ```typescript
   // Before: Just business logic
   async function issueAsset(params) {
     return await cantonClient.issueAsset(params);
   }
   
   // After: Business logic + OmniLearn
   async function issueAsset(params) {
     const asset = await cantonClient.issueAsset(params);
     
     await omnilearn.record({
       type: 'asset_issued',
       data: { assetId: asset.id, ... },
     });
     
     return asset;
   }
   ```

4. **Add Schema Registration**
   ```typescript
   // On service startup
   await omnilearn.registerSchema({
     typeName: 'asset_issued',
     schema: { ... },
   });
   ```

5. **Add Error Handling**
   ```typescript
   try {
     await omnilearn.record({ type: 'asset_issued', data: { ... } });
   } catch (error) {
     // Don't fail business logic
     console.error('OmniLearn recording failed:', error);
   }
   ```

---

## 📚 Resources

- **OmniLearn SDK Docs**: [README.md](/packages/sdk/README.md)
- **OmniLearn Master Vision**: [OMNILEARN_MASTER_VISION.md](/omnilearn/OMNILEARN_MASTER_VISION.md)
- **Canton Documentation**: [Canton Network Docs](https://docs.canton.network)
- **Example Integration**: [examples/canton-integration.ts](/packages/sdk/examples/canton-integration.ts)

---

## 🤝 Support

- **OmniLearn Issues**: [GitHub Issues](https://github.com/Cloud99p/omnilearn-agent/issues)
- **Canton Issues**: [Canton Issues](https://github.com/Cloud99p/canton-rwa/issues)
- **Email**: emmanuelhosea09@gmail.com

---

**Canton RWA + OmniLearn = Smarter, Connected Intelligence** 🧠☁️🚀
