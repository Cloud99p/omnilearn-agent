# @omnilearn/sdk

**Universal knowledge layer SDK for AI + blockchain systems**

Connect any service to OmniLearn's distributed intelligence network. Record knowledge, search across domains, and stream real-time updates.

---

## 🌟 Features

- **Domain Agnostic**: Works with blockchain, e-commerce, healthcare, education, and any domain
- **Semantic Search**: TF-IDF + vector embeddings for intelligent retrieval
- **Cross-Domain Queries**: Find patterns across completely different domains
- **Real-time Streaming**: Subscribe to knowledge updates as they happen
- **Cryptographic Proofs**: SHA-256 audit trail for every knowledge node
- **Hebbian Learning**: Automatically discover relationships between knowledge
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Production Ready**: Retry logic, rate limiting, timeout handling

---

## 📦 Installation

```bash
npm install @omnilearn/sdk
# or
pnpm add @omnilearn/sdk
# or
yarn add @omnilearn/sdk
```

---

## 🚀 Quick Start

### 1. Initialize Client

```typescript
import { OmniLearnClient } from '@omnilearn/sdk';

const client = new OmniLearnClient({
  apiKey: 'omni_sk_your_key_here',
  apiBaseUrl: 'https://api.omnilearn.ai',
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
  domain: 'blockchain', // Optional: categorize your service
});
```

### 2. Record Knowledge

```typescript
// Fire-and-forget (fastest)
await client.record({
  type: 'asset_issued',
  data: {
    assetId: 'asset_123',
    assetType: 'treasury-bond',
    totalValue: 1000000,
    issuer: 'US Treasury',
  },
  metadata: {
    userId: 'user_456',
  },
});

// With acknowledgment (get node ID)
const response = await client.recordAndWait({
  type: 'trade_executed',
  data: {
    tradeId: 'trade_abc',
    price: 50000,
  },
});

console.log('Node ID:', response.nodeId);
console.log('Proof Hash:', response.proofHash);
```

### 3. Search Knowledge

```typescript
const results = await client.search({
  query: 'treasury bond issuance trends',
  sources: ['canton-rwa', 'agentflow'],
  types: ['asset_issued', 'trade_executed'],
  limit: 20,
});

console.log(`Found ${results.total} results`);
results.nodes.forEach(node => {
  console.log(node.data);
});
```

### 4. Stream Real-time Updates

```typescript
const stream = client.stream({
  types: ['asset_issued', 'trade_executed'],
  batchSize: 10,
});

for await (const event of stream) {
  console.log('New knowledge:', event.data);
}
```

---

## 📚 API Reference

### OmniLearnClient

```typescript
class OmniLearnClient {
  // Knowledge Recording
  record(params: RecordParams): Promise<void>;
  recordAndWait(params: RecordParams): Promise<RecordResponse>;
  recordBatch(params: BatchRecordParams): Promise<BatchRecordResponse>;
  
  // Knowledge Search
  search(params: SearchParams): Promise<SearchResponse>;
  query(query: string, limit?: number): Promise<KnowledgeNode[]>;
  
  // Real-time Streaming
  stream(params?: StreamParams): AsyncIterable<StreamEvent>;
  
  // Service Management
  getStats(): Promise<ServiceStats>;
  getServiceInfo(): Promise<ServiceInfo>;
  
  // Schema Management
  registerSchema(params: RegisterSchemaParams): Promise<RegisterSchemaResponse>;
  listSchemas(): Promise<KnowledgeSchema[]>;
  
  // Health Check
  health(): Promise<HealthStatus>;
}
```

### Configuration

```typescript
interface OmniLearnClientConfig {
  apiKey: string;              // Required: Service API key
  apiBaseUrl: string;          // Required: API URL
  serviceName: string;         // Required: Unique service identifier
  serviceVersion?: string;     // Optional: Semantic version
  retryAttempts?: number;      // Optional: Default 3
  timeout?: number;            // Optional: Default 30000ms
  enableLogging?: boolean;     // Optional: Default false
  domain?: string;             // Optional: Domain category
}
```

### Record Parameters

```typescript
interface RecordParams {
  type: string;                // Required: Knowledge type
  data: Record<string, any>;   // Required: Structured data
  metadata?: RecordMetadata;   // Optional: Contextual metadata
  proofHash?: string;          // Optional: Pre-computed SHA-256 hash
  priority?: 'low' | 'normal' | 'high'; // Optional: Default 'normal'
}
```

### Search Parameters

```typescript
interface SearchParams {
  query: string;               // Required: Natural language query
  sources?: string[];          // Optional: Filter by service names
  types?: string[];            // Optional: Filter by knowledge types
  domains?: string[];          // Optional: Filter by domains
  limit?: number;              // Optional: Default 10, max 100
  offset?: number;             // Optional: For pagination
  timeRange?: TimeRange;       // Optional: Time range filter
}
```

---

## 🌍 Domain Examples

### Blockchain Domain

```typescript
await client.record({
  type: 'asset_issued',
  data: {
    assetId: 'bond_001',
    assetType: 'treasury-bond',
    totalValue: 1000000,
    issuer: 'US Treasury',
    jurisdiction: 'United States',
  },
});

await client.record({
  type: 'bundle_submitted',
  data: {
    bundleId: 'bundle_123',
    success: true,
    tip: 1000000,
    latency: 432,
  },
});
```

### E-commerce Domain

```typescript
await client.record({
  type: 'purchase_completed',
  data: {
    orderId: 'order_456',
    userId: 'user_789',
    amount: 299.99,
    category: 'electronics',
    productId: 'prod_abc',
  },
});
```

### Healthcare Domain

```typescript
await client.record({
  type: 'treatment_administered',
  data: {
    patientId: 'patient_123',
    treatment: 'chemotherapy',
    provider: 'Dr. Smith',
    outcome: 'positive',
    sideEffects: ['nausea'],
  },
});
```

### Education Domain

```typescript
await client.record({
  type: 'lesson_completed',
  data: {
    studentId: 'student_456',
    lessonId: 'lesson_789',
    score: 85,
    timeSpent: 1800,
    attempts: 2,
  },
});
```

---

## 🔧 Advanced Usage

### Cross-Domain Queries

```typescript
// Find patterns across blockchain, education, and e-commerce
const results = await client.search({
  query: 'performance improvement over time',
  domains: ['blockchain', 'education', 'ecommerce'],
  limit: 30,
});
```

### Time-Range Filtering

```typescript
// Search for failures in the last 7 days
const results = await client.search({
  query: 'failed transactions',
  timeRange: {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
  },
  types: ['transaction_failed', 'bundle_failed'],
  limit: 20,
});
```

### Multi-Source Aggregation

```typescript
// Aggregate from multiple services
const results = await client.search({
  query: 'asset trading activity',
  sources: ['canton-rwa', 'tx-stack', 'agentflow'],
  types: ['trade_executed', 'asset_issued', 'bundle_submitted'],
  limit: 50,
});
```

### Register Custom Schema

```typescript
await client.registerSchema({
  typeName: 'custom_event',
  domain: 'blockchain',
  schema: {
    type: 'object',
    required: ['eventId', 'status'],
    properties: {
      eventId: { type: 'string' },
      status: { type: 'string', enum: ['success', 'failed', 'pending'] },
      metadata: { type: 'object' },
    },
  },
});
```

---

## 🛠️ Error Handling

```typescript
import { OmniLearnError } from '@omnilearn/sdk';

try {
  await client.record({ type: 'test', data: {} });
} catch (error) {
  if (error instanceof OmniLearnError) {
    console.error('Error Code:', error.code);
    console.error('Message:', error.message);
    console.error('Status:', error.status);
    console.error('Details:', error.details);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Common Error Codes

- `HTTP_ERROR`: HTTP request failed
- `RATE_LIMIT_EXCEEDED`: API rate limit exceeded
- `INVALID_SCHEMA`: Knowledge type doesn't match registered schema
- `INVALID_DATA`: Data doesn't match schema validation
- `MAX_RETRIES_EXCEEDED`: All retry attempts failed
- `STREAM_CONNECTION_FAILED`: WebSocket connection failed
- `STREAM_NOT_SUPPORTED`: Browser doesn't support ReadableStream

---

## 📊 Service Management

### Get Statistics

```typescript
const stats = await client.getStats();

console.log('Nodes Recorded:', stats.nodesRecorded);
console.log('Edges Created:', stats.edgesCreated);
console.log('API Calls Today:', stats.apiCallsToday);
console.log('Rate Limit Remaining:', stats.rateLimitRemaining);
```

### Get Service Info

```typescript
const info = await client.getServiceInfo();

console.log('Service Name:', info.name);
console.log('Version:', info.version);
console.log('Domain:', info.domain);
console.log('Rate Limit:', info.rateLimit.perMinute, 'per minute');
```

---

## 🏗️ Integration Guide

### Step 1: Install SDK

```bash
npm install @omnilearn/sdk
```

### Step 2: Register Service

1. Go to OmniLearn Dashboard
2. Click "Register Service"
3. Fill in service details
4. Copy generated API key

### Step 3: Initialize Client

```typescript
import { OmniLearnClient } from '@omnilearn/sdk';

const omnilearn = new OmniLearnClient({
  apiKey: process.env.OMNILEARN_API_KEY,
  apiBaseUrl: 'https://api.omnilearn.ai',
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
});
```

### Step 4: Define Schemas

```typescript
await omnilearn.registerSchema({
  typeName: 'my_event_type',
  domain: 'your-domain',
  schema: {
    // JSON Schema definition
  },
});
```

### Step 5: Record Knowledge

```typescript
async function myBusinessLogic() {
  // Your business logic here
  
  // Record outcome to OmniLearn
  await omnilearn.record({
    type: 'my_event_type',
    data: { /* your data */ },
  });
}
```

### Step 6: Query Insights

```typescript
async function getInsights() {
  const results = await omnilearn.search({
    query: 'your query',
    limit: 10,
  });
  
  return results.nodes;
}
```

---

## 🌐 Deployment

### Environment Variables

```bash
# Required
OMNILEARN_API_KEY=omni_sk_your_key_here
OMNILEARN_API_URL=https://api.omnilearn.ai

# Optional
OMNILEARN_SERVICE_NAME=my-service
OMNILEARN_SERVICE_VERSION=1.0.0
OMNILEARN_ENABLE_LOGGING=false
```

### Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

CMD ["pnpm", "start"]
```

---

## 📖 Examples

See the `examples/` directory for complete working examples:

- `basic-usage.ts` - Fundamental operations
- `advanced-search.ts` - Advanced search patterns
- `streaming.ts` - Real-time streaming
- `canton-integration.ts` - Canton RWA integration (coming soon)

---

## 🔒 Security

- **API Keys**: Never expose API keys in client-side code
- **TLS**: All connections use TLS 1.3
- **Data Encryption**: Data encrypted at rest with AES-256
- **Audit Trail**: SHA-256 proof chain for compliance
- **Rate Limiting**: Prevent abuse with configurable limits

---

## 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](/CONTRIBUTING.md) for guidelines.

---

## 📄 License

This project is licensed under AGPL-3.0-or-later. See [LICENSE](/LICENSE) for details.

Commercial licensing available for closed-source products. See [LICENSE-COMMERCIAL.md](/LICENSE-COMMERCIAL.md).

---

## 📞 Support

- **GitHub Issues**: [Report bugs](https://github.com/Cloud99p/omnilearn-agent/issues)
- **Email**: emmanuelhosea09@gmail.com
- **Documentation**: [GitHub Wiki](https://github.com/Cloud99p/omnilearn-agent/wiki)

---

**Built with ❤️ by Emmanuel Nenpan Hosea**

*The brain. Not the mouth. 🧠☁️🚀*
