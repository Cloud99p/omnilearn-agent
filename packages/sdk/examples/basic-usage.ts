/**
 * Basic Usage Example - OmniLearn SDK
 * 
 * This example shows the fundamental operations:
 * - Initialize client
 * - Record knowledge
 * - Search knowledge
 * - Check health
 */

import { OmniLearnClient, OmniLearnError } from '../src/index';

// ============================================================================
// 1. INITIALIZATION
// ============================================================================

const client = new OmniLearnClient({
  apiKey: process.env.OMNILEARN_API_KEY || 'omni_sk_your_key_here',
  apiBaseUrl: process.env.OMNILEARN_API_URL || 'https://api.omnilearn.ai',
  serviceName: 'example-service',
  serviceVersion: '1.0.0',
  domain: 'blockchain', // Optional: categorize your service
  enableLogging: true,  // Set to false in production
  retryAttempts: 3,
  timeout: 30000,
});

// ============================================================================
// 2. RECORD KNOWLEDGE
// ============================================================================

async function recordExample() {
  console.log('\n=== Recording Knowledge ===\n');
  
  try {
    // Example 1: Simple record (fire-and-forget)
    await client.record({
      type: 'asset_issued',
      data: {
        assetId: 'asset_123',
        assetType: 'treasury-bond',
        totalValue: 1000000,
        currency: 'USD',
        issuer: 'US Treasury',
        jurisdiction: 'United States',
      },
      metadata: {
        userId: 'user_456',
        sessionId: 'session_789',
      },
      priority: 'normal',
    });
    
    console.log('✅ Knowledge recorded (fire-and-forget)');
    
    // Example 2: Record with acknowledgment
    const response = await client.recordAndWait({
      type: 'trade_executed',
      data: {
        tradeId: 'trade_abc',
        assetId: 'asset_123',
        price: 98.5,
        quantity: 10000,
        side: 'buy',
        timestamp: new Date().toISOString(),
      },
      metadata: {
        userId: 'user_456',
      },
    });
    
    console.log('✅ Knowledge recorded with acknowledgment:');
    console.log(`   Node ID: ${response.nodeId}`);
    console.log(`   Proof Hash: ${response.proofHash}`);
    console.log(`   Timestamp: ${response.timestamp}`);
    
    // Example 3: Batch recording
    const batchResult = await client.recordBatch({
      records: [
        {
          type: 'price_update',
          data: { assetId: 'asset_123', price: 98.6, change: 0.1 },
        },
        {
          type: 'price_update',
          data: { assetId: 'asset_456', price: 102.3, change: -0.5 },
        },
        {
          type: 'price_update',
          data: { assetId: 'asset_789', price: 99.1, change: 0.3 },
        },
      ],
    });
    
    console.log('\n✅ Batch recording complete:');
    console.log(`   Recorded: ${batchResult.recorded}`);
    console.log(`   Failed: ${batchResult.failed}`);
    console.log(`   Node IDs: ${batchResult.nodeIds.join(', ')}`);
    
  } catch (error) {
    if (error instanceof OmniLearnError) {
      console.error('❌ OmniLearn Error:', error.code, error.message);
      if (error.details) {
        console.error('   Details:', error.details);
      }
    } else {
      console.error('❌ Unexpected error:', error);
    }
  }
}

// ============================================================================
// 3. SEARCH KNOWLEDGE
// ============================================================================

async function searchExample() {
  console.log('\n=== Searching Knowledge ===\n');
  
  try {
    // Example 1: Simple search
    const results = await client.search({
      query: 'treasury bond issuance',
      limit: 10,
    });
    
    console.log(`Found ${results.total} results in ${results.searchTimeMs}ms:\n`);
    
    results.nodes.forEach((node, index) => {
      console.log(`${index + 1}. [${node.type}] from ${node.source}`);
      console.log(`   Relevance: ${(node.relevanceScore || 0).toFixed(2)}`);
      console.log(`   Data:`, JSON.stringify(node.data, null, 2));
      console.log();
    });
    
    // Example 2: Filtered search
    const filteredResults = await client.search({
      query: 'asset issuance trends',
      sources: ['canton-rwa', 'agentflow'],
      types: ['asset_issued', 'trade_executed'],
      domains: ['blockchain'],
      limit: 20,
      timeRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // Last 7 days
        end: new Date().toISOString(),
      },
    });
    
    console.log(`\nFiltered search found ${filteredResults.total} results`);
    
    // Example 3: Simple query method
    const nodes = await client.query('recent trades', 5);
    console.log(`\nSimple query returned ${nodes.length} nodes`);
    
  } catch (error) {
    console.error('❌ Search error:', error);
  }
}

// ============================================================================
// 4. SERVICE MANAGEMENT
// ============================================================================

async function serviceManagementExample() {
  console.log('\n=== Service Management ===\n');
  
  try {
    // Get service statistics
    const stats = await client.getStats();
    console.log('Service Statistics:');
    console.log(`  Nodes Recorded: ${stats.nodesRecorded}`);
    console.log(`  Edges Created: ${stats.edgesCreated}`);
    console.log(`  Proofs Generated: ${stats.proofsGenerated}`);
    console.log(`  API Calls Today: ${stats.apiCallsToday}`);
    console.log(`  Rate Limit Remaining: ${stats.rateLimitRemaining}`);
    console.log(`  Rate Limit Reset: ${stats.rateLimitReset}`);
    console.log();
    
    // Get service info
    const info = await client.getServiceInfo();
    console.log('Service Info:');
    console.log(`  Name: ${info.name}`);
    console.log(`  Version: ${info.version}`);
    console.log(`  Domain: ${info.domain}`);
    console.log(`  Status: ${info.status}`);
    console.log(`  Rate Limit: ${info.rateLimit.perMinute}/min, ${info.rateLimit.perDay}/day`);
    console.log();
    
  } catch (error) {
    console.error('❌ Service management error:', error);
  }
}

// ============================================================================
// 5. SCHEMA MANAGEMENT
// ============================================================================

async function schemaManagementExample() {
  console.log('\n=== Schema Management ===\n');
  
  try {
    // Register a new schema
    const schema = await client.registerSchema({
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
    
    console.log('Schema registered:');
    console.log(`  Schema ID: ${schema.schemaId}`);
    console.log(`  Type Name: ${schema.typeName}`);
    console.log(`  Version: ${schema.version}`);
    console.log();
    
    // List all schemas
    const schemas = await client.listSchemas();
    console.log(`Available schemas (${schemas.length}):`);
    schemas.forEach(s => {
      console.log(`  - ${s.typeName} (${s.domain}) v${s.version}`);
    });
    console.log();
    
  } catch (error) {
    console.error('❌ Schema management error:', error);
  }
}

// ============================================================================
// 6. HEALTH CHECK
// ============================================================================

async function healthCheckExample() {
  console.log('\n=== Health Check ===\n');
  
  try {
    const health = await client.health();
    
    console.log('API Health Status:');
    console.log(`  Overall: ${health.status}`);
    console.log(`  API Server: ${health.apiStatus}`);
    console.log(`  Database: ${health.databaseStatus}`);
    console.log(`  Latency: ${health.latencyMs}ms`);
    console.log(`  Version: ${health.version}`);
    console.log();
    
    if (health.status !== 'healthy') {
      console.warn('⚠️  API is not healthy!');
    } else {
      console.log('✅ API is healthy');
    }
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
}

// ============================================================================
// 7. REAL-TIME STREAMING
// ============================================================================

async function streamingExample() {
  console.log('\n=== Real-time Streaming ===\n');
  console.log('Listening for real-time knowledge updates...\n');
  
  try {
    const stream = client.stream({
      types: ['asset_issued', 'trade_executed'],
      sources: ['canton-rwa'],
      batchSize: 10,
    });
    
    let count = 0;
    const maxEvents = 5; // Stop after 5 events for demo
    
    for await (const event of stream) {
      count++;
      console.log(`[${count}] Stream Event (${event.type}):`);
      console.log(`   Timestamp: ${event.timestamp}`);
      console.log(`   Data:`, JSON.stringify(event.data, null, 2));
      console.log();
      
      if (count >= maxEvents) {
        console.log(`Received ${maxEvents} events, stopping stream...`);
        break;
      }
    }
    
  } catch (error) {
    console.error('❌ Streaming error:', error);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║        OmniLearn SDK - Basic Usage Examples              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  // Run examples sequentially
  await healthCheckExample();
  await recordExample();
  await searchExample();
  await serviceManagementExample();
  await schemaManagementExample();
  
  // Uncomment to test streaming (runs indefinitely until stopped)
  // await streamingExample();
  
  console.log('\n✅ All examples completed!\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
