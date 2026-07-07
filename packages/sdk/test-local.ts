/**
 * Local Test Script for OmniLearn SDK
 * 
 * This script tests the SDK against a local API server
 * 
 * Usage:
 * 1. Start API server: cd artifacts/api-server && pnpm run dev
 * 2. Run test: cd packages/sdk && npx tsx test-local.ts
 */

import { OmniLearnClient } from './src/index.js';

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const SERVICE_NAME = process.env.SERVICE_NAME || 'test-service';

console.log('🧪 OmniLearn SDK Local Test');
console.log('===========================\n');
console.log(`API URL: ${API_BASE_URL}`);
console.log(`Service: ${SERVICE_NAME}\n`);

// Create client
const client = new OmniLearnClient({
  apiKey: 'test-api-key', // Not enforced in local dev
  apiBaseUrl: API_BASE_URL,
  serviceName: SERVICE_NAME,
  enableLogging: true,
});

async function runTests() {
  try {
    // Test 1: Health Check
    console.log('📋 Test 1: Health Check');
    console.log('------------------------');
    const health = await client.health();
    console.log('✅ Health:', health);
    console.log('');

    // Test 2: Record Knowledge
    console.log('📝 Test 2: Record Knowledge');
    console.log('----------------------------');
    const recordResult = await client.record({
      type: 'test_event',
      data: {
        eventId: 'test-001',
        status: 'success',
        message: 'Hello from SDK test!',
        timestamp: new Date().toISOString(),
      },
    });
    console.log('✅ Record result:', recordResult);
    console.log('');

    // Test 3: Record with acknowledgment
    console.log('📝 Test 3: Record with Acknowledgment');
    console.log('--------------------------------------');
    const recordAndWaitResult = await client.recordAndWait({
      type: 'user_action',
      data: {
        userId: 'user-123',
        action: 'login',
        platform: 'web',
      },
    });
    console.log('✅ Record with ack:', recordAndWaitResult);
    console.log('');

    // Test 4: Batch Record
    console.log('📦 Test 4: Batch Record');
    console.log('-----------------------');
    const batchResult = await client.recordBatch({
      records: [
        {
          type: 'product_view',
          data: { productId: 'prod-001', category: 'electronics' },
        },
        {
          type: 'product_view',
          data: { productId: 'prod-002', category: 'books' },
        },
        {
          type: 'purchase',
          data: { productId: 'prod-001', amount: 99.99 },
        },
      ],
    });
    console.log('✅ Batch result:', batchResult);
    console.log('');

    // Wait a moment for indexing
    console.log('⏳ Waiting for indexing...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('');

    // Test 5: Search Knowledge
    console.log('🔍 Test 5: Search Knowledge');
    console.log('---------------------------');
    const searchResult = await client.search({
      query: 'test event',
      limit: 10,
    });
    console.log('✅ Search results:', searchResult.results.length, 'found');
    if (searchResult.results.length > 0) {
      console.log('   First result:', JSON.stringify(searchResult.results[0], null, 2));
    }
    console.log('');

    // Test 6: Get Service Stats
    console.log('📊 Test 6: Get Service Stats');
    console.log('-----------------------------');
    const stats = await client.getStats();
    console.log('✅ Stats:', JSON.stringify(stats, null, 2));
    console.log('');

    // Test 7: Search for batch items
    console.log('🔍 Test 7: Search for Batch Items');
    console.log('----------------------------------');
    const batchSearch = await client.search({
      query: 'product',
      limit: 5,
    });
    console.log('✅ Batch search results:', batchSearch.results.length, 'found');
    console.log('');

    // Summary
    console.log('🎉 All Tests Passed!');
    console.log('====================');
    console.log('✅ Health check');
    console.log('✅ Record knowledge');
    console.log('✅ Record with acknowledgment');
    console.log('✅ Batch record');
    console.log('✅ Search knowledge');
    console.log('✅ Get service stats');
    console.log('');
    console.log('SDK is working correctly with the v1 API! 🚀');

  } catch (error: any) {
    console.error('❌ Test Failed!');
    console.error('==============');
    console.error('Error:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('1. Make sure API server is running: cd artifacts/api-server && pnpm run dev');
    console.error('2. Check API server is listening on:', API_BASE_URL);
    console.error('3. Verify network connectivity');
    console.error('');
    console.error('Full error:', error);
    process.exit(1);
  }
}

// Run tests
runTests();
