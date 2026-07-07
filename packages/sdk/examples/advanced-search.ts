/**
 * Advanced Search Example - OmniLearn SDK
 * 
 * This example demonstrates advanced search capabilities:
 * - Cross-domain queries
 * - Time-range filtering
 * - Multi-source aggregation
 * - Semantic similarity search
 */

import { OmniLearnClient } from '../src/index';

// Initialize client
const client = new OmniLearnClient({
  apiKey: process.env.OMNILEARN_API_KEY || 'omni_sk_your_key_here',
  apiBaseUrl: process.env.OMNILEARN_API_URL || 'https://api.omnilearn.ai',
  serviceName: 'search-demo',
  domain: 'research',
});

// ============================================================================
// 1. CROSS-DOMAIN QUERY
// ============================================================================

/**
 * Query knowledge across multiple domains
 * 
 * This demonstrates OmniLearn's unique capability: finding
 * patterns across completely different domains (e.g., blockchain
 * and education)
 */
async function crossDomainQuery() {
  console.log('\n=== Cross-Domain Query ===\n');
  
  try {
    const results = await client.search({
      query: 'patterns in asset performance over time',
      domains: ['blockchain', 'education', 'ecommerce'],
      limit: 30,
    });
    
    console.log(`Found ${results.total} results across domains:\n`);
    
    // Group by domain
    const byDomain: Record<string, number> = {};
    
    results.nodes.forEach(node => {
      const domain = node.domain || 'unknown';
      byDomain[domain] = (byDomain[domain] || 0) + 1;
      
      console.log(`[${domain.toUpperCase()}] ${node.type}`);
      console.log(`   Source: ${node.source}`);
      console.log(`   Relevance: ${(node.relevanceScore || 0).toFixed(2)}`);
      console.log(`   Data:`, JSON.stringify(node.data, null, 2));
      console.log();
    });
    
    console.log('\nDistribution by domain:');
    Object.entries(byDomain).forEach(([domain, count]) => {
      console.log(`  ${domain}: ${count} results`);
    });
    
  } catch (error) {
    console.error('❌ Cross-domain query error:', error);
  }
}

// ============================================================================
// 2. TIME-RANGE FILTERED SEARCH
// ============================================================================

/**
 * Search knowledge within a specific time range
 * 
 * Useful for trend analysis, anomaly detection, and
 * historical pattern recognition
 */
async function timeRangeSearch() {
  console.log('\n=== Time-Range Search ===\n');
  
  try {
    // Define time range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const results = await client.search({
      query: 'failed transactions',
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      types: ['transaction_failed', 'bundle_failed'],
      limit: 20,
    });
    
    console.log(`Found ${results.total} failures in last 7 days:\n`);
    
    // Analyze failure patterns
    const byType: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    
    results.nodes.forEach(node => {
      const type = node.type;
      const date = node.createdAt.split('T')[0];
      
      byType[type] = (byType[type] || 0) + 1;
      byDay[date] = (byDay[date] || 0) + 1;
      
      console.log(`${date} - ${type}:`, node.data);
    });
    
    console.log('\nFailure patterns:');
    console.log('  By type:', JSON.stringify(byType, null, 2));
    console.log('  By day:', JSON.stringify(byDay, null, 2));
    
  } catch (error) {
    console.error('❌ Time-range search error:', error);
  }
}

// ============================================================================
// 3. MULTI-SOURCE AGGREGATION
// ============================================================================

/**
 * Aggregate knowledge from multiple services
 * 
 * Demonstrates how OmniLearn brings together data from
 * different sources to provide a unified view
 */
async function multiSourceAggregation() {
  console.log('\n=== Multi-Source Aggregation ===\n');
  
  try {
    // Aggregate from multiple services
    const results = await client.search({
      query: 'asset trading activity',
      sources: ['canton-rwa', 'tx-stack', 'agentflow'],
      types: ['trade_executed', 'asset_issued', 'bundle_submitted'],
      limit: 50,
    });
    
    console.log(`Aggregated ${results.total} events from multiple sources:\n`);
    
    // Group by source
    const bySource: Record<string, number> = {};
    const byType: Record<string, number> = {};
    
    results.nodes.forEach(node => {
      const source = node.source;
      const type = node.type;
      
      bySource[source] = (bySource[source] || 0) + 1;
      byType[type] = (byType[type] || 0) + 1;
    });
    
    console.log('By Source:');
    Object.entries(bySource).forEach(([source, count]) => {
      console.log(`  ${source}: ${count} events`);
    });
    
    console.log('\nBy Type:');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} events`);
    });
    
    console.log('\nSample events:');
    results.nodes.slice(0, 5).forEach((node, index) => {
      console.log(`${index + 1}. [${node.source}] ${node.type}`);
      console.log(`   Data:`, JSON.stringify(node.data, null, 2));
      console.log();
    });
    
  } catch (error) {
    console.error('❌ Multi-source aggregation error:', error);
  }
}

// ============================================================================
// 4. SEMANTIC SIMILARITY SEARCH
// ============================================================================

/**
 * Find semantically similar knowledge nodes
 * 
 * Uses vector embeddings to find related knowledge even
 * when the query doesn't match exact keywords
 */
async function semanticSimilaritySearch() {
  console.log('\n=== Semantic Similarity Search ===\n');
  
  try {
    // Query with different phrasing than the actual data
    const results = await client.search({
      query: 'successful trade executions', // Instead of "trade_executed"
      types: ['trade_executed', 'bundle_submitted'],
      limit: 15,
    });
    
    console.log(`Found ${results.total} semantically similar results:\n`);
    
    // Sort by relevance
    const sorted = results.nodes
      .filter(n => n.relevanceScore)
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    
    console.log('Top results by relevance:');
    sorted.slice(0, 5).forEach((node, index) => {
      console.log(`${index + 1}. Relevance: ${(node.relevanceScore || 0).toFixed(2)}`);
      console.log(`   Type: ${node.type}`);
      console.log(`   Data:`, JSON.stringify(node.data, null, 2));
      console.log();
    });
    
  } catch (error) {
    console.error('❌ Semantic search error:', error);
  }
}

// ============================================================================
// 5. PATTERN RECOGNITION
// ============================================================================

/**
 * Identify patterns in knowledge graph
 * 
 * Searches for recurring patterns across multiple dimensions
 */
async function patternRecognition() {
  console.log('\n=== Pattern Recognition ===\n');
  
  try {
    // Search for patterns in specific scenarios
    const patterns = await client.search({
      query: 'success after multiple retry attempts',
      limit: 30,
    });
    
    console.log(`Found ${patterns.total} pattern matches:\n`);
    
    // Analyze patterns
    const patternsByType: Record<string, number> = {};
    const successRate: Record<string, number> = {};
    
    patterns.nodes.forEach(node => {
      const type = node.type;
      patternsByType[type] = (patternsByType[type] || 0) + 1;
      
      // Check if this indicates success
      if (node.data.success === true || node.data.status === 'success') {
        successRate[type] = (successRate[type] || 0) + 1;
      }
    });
    
    console.log('Patterns by type:');
    Object.entries(patternsByType).forEach(([type, count]) => {
      const success = successRate[type] || 0;
      const rate = ((success / count) * 100).toFixed(1);
      console.log(`  ${type}: ${count} occurrences (${rate}% success)`);
    });
    
  } catch (error) {
    console.error('❌ Pattern recognition error:', error);
  }
}

// ============================================================================
// 6. TREND ANALYSIS
// ============================================================================

/**
 * Analyze trends over time
 * 
 * Compares knowledge across different time periods
 * to identify trends and changes
 */
async function trendAnalysis() {
  console.log('\n=== Trend Analysis ===\n');
  
  try {
    // Compare last 7 days vs previous 7 days
    const endDate = new Date();
    const midPoint = new Date();
    midPoint.setDate(midPoint.getDate() - 7);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 14);
    
    const recentResults = await client.search({
      query: 'asset transactions',
      timeRange: {
        start: midPoint.toISOString(),
        end: endDate.toISOString(),
      },
      limit: 100,
    });
    
    const previousResults = await client.search({
      query: 'asset transactions',
      timeRange: {
        start: startDate.toISOString(),
        end: midPoint.toISOString(),
      },
      limit: 100,
    });
    
    console.log('Trend Analysis:');
    console.log(`  Last 7 days: ${recentResults.total} events`);
    console.log(`  Previous 7 days: ${previousResults.total} events`);
    
    const change = previousResults.total > 0
      ? ((recentResults.total - previousResults.total) / previousResults.total * 100).toFixed(1)
      : 'N/A';
    
    console.log(`  Change: ${change}%`);
    
    if (parseFloat(change) > 10) {
      console.log('  📈 Upward trend detected!');
    } else if (parseFloat(change) < -10) {
      console.log('  📉 Downward trend detected!');
    } else {
      console.log('  ➡️  Stable trend');
    }
    
  } catch (error) {
    console.error('❌ Trend analysis error:', error);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║        OmniLearn SDK - Advanced Search Examples          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  await crossDomainQuery();
  await timeRangeSearch();
  await multiSourceAggregation();
  await semanticSimilaritySearch();
  await patternRecognition();
  await trendAnalysis();
  
  console.log('\n✅ All advanced search examples completed!\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}
