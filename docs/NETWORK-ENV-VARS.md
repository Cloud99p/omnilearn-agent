# Environment Variables - Network Configuration

## Core Network Variables

```bash
# WebSocket Discovery Server
DISCOVERY_PORT=8765              # Port for WebSocket discovery server
DISCOVERY_HOST=0.0.0.0           # Bind address for discovery server

# Cluster Formation
CLUSTER_DISCOVERY_RADIUS_KM=50   # Radius for cluster formation (Tier 2 threshold)
CLUSTER_MIN_NODES=50             # Minimum nodes for Tier 2 cluster

# Node Registration
NODE_REGISTRATION_ENABLED=true   # Allow new nodes to register
NODE_REGISTRATION_AUTH_REQUIRED=true  # Require secret key for registration
```

## Production Deployment

### Railway Deployment

```bash
# Add to Railway environment variables
DISCOVERY_PORT=8765
DISCOVERY_HOST=0.0.0.0
CLUSTER_DISCOVERY_RADIUS_KM=50
CLUSTER_MIN_NODES=50
NODE_REGISTRATION_ENABLED=true
NODE_REGISTRATION_AUTH_REQUIRED=true
```

### Docker Compose

```yaml
services:
  omnilearn-api:
    environment:
      - DISCOVERY_PORT=8765
      - DISCOVERY_HOST=0.0.0.0
      - CLUSTER_DISCOVERY_RADIUS_KM=50
    ports:
      - "3000:3000"   # API server
      - "8765:8765"   # WebSocket discovery
    volumes:
      - ./migrations:/app/migrations  # Database migrations
```

### Kubernetes Deployment

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: omnilearn-network-config
data:
  DISCOVERY_PORT: "8765"
  DISCOVERY_HOST: "0.0.0.0"
  CLUSTER_DISCOVERY_RADIUS_KM: "50"
  CLUSTER_MIN_NODES: "50"
  NODE_REGISTRATION_ENABLED: "true"
  NODE_REGISTRATION_AUTH_REQUIRED: "true"
```

## Security

### Secret Key Management

When `NODE_REGISTRATION_AUTH_REQUIRED=true`, each node needs a secret key:

1. Generate unique secret key for each node:
   ```bash
   openssl rand -hex 32
   ```

2. Store in secure location (Vault, Railway secrets, etc.)

3. Node registration requires:
   ```typescript
   {
     name: "Node 1",
     endpoint: "http://node1.example.com",
     secretKey: "your-generated-secret-key",
     region: "us-east-1",
     location: { lat: 40.7128, lng: -74.0060 }
   }
   ```

### Network Isolation

For production deployments:

- Use private network for node-to-node communication
- Enable TLS for WebSocket connections (WSS)
- Implement rate limiting on node registration
- Monitor for suspicious cluster formation patterns

## Monitoring

### Metrics to Track

```bash
# Node metrics
network_nodes_total
network_nodes_online
network_nodes_offline
network_nodes_by_tier{tier="1"}
network_nodes_by_tier{tier="2"}
# ... etc

# Cluster metrics
network_clusters_total
network_clusters_by_tier{tier="2"}
network_cluster_size
network_cluster_load

# Heartbeat metrics
network_heartbeats_total
network_heartbeats_failed
network_node_uptime_seconds
```

### Health Check Endpoints

```bash
# Cluster health
GET /api/network/health

# Node registration status
GET /api/network/nodes/status

# Cluster formation status
GET /api/network/clusters/status
```

## Migration Guide

### From In-Memory to Persistent

1. **Run database migration:**
   ```bash
   psql $DATABASE_URL < artifacts/api-server/migrations/add_network_clusters.sql
   ```

2. **Update code:**
   - ClusterManager now uses PostgreSQL (already done)
   - DiscoveryService now uses WebSocket (already done)

3. **Restart services:**
   ```bash
   # Railway auto-deploys on push
   git push origin main
   ```

4. **Verify:**
   ```bash
   # Check cluster state persisted
   psql $DATABASE_URL -c "SELECT * FROM network_clusters;"
   
   # Check node state persisted
   psql $DATABASE_URL -c "SELECT * FROM network_ghost_nodes;"
   ```

## Troubleshooting

### WebSocket Connection Issues

```bash
# Check if discovery server is running
curl http://localhost:8765

# Check WebSocket logs
tail -f /var/log/omnilearn/discovery.log
```

### Cluster Formation Issues

```bash
# Check nearby nodes
psql $DATABASE_URL -c "SELECT * FROM network_ghost_nodes WHERE cluster_id IS NULL;"

# Check cluster thresholds
psql $DATABASE_URL -c "SELECT COUNT(*) FROM network_ghost_nodes WHERE cluster_id IS NULL;"
```

### Node Registration Issues

```bash
# Check registration logs
grep "Node registered" /var/log/omnilearn/api.log

# Verify secret key
curl -X POST http://localhost:3000/api/network/nodes \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "endpoint": "http://test.local", "secretKey": "test-key"}'
```

## References

- [ClusterManager Implementation](packages/network-hierarchy/src/cluster-manager.ts)
- [DiscoveryServer Implementation](artifacts/api-server/src/lib/discovery-server.ts)
- [Database Schema](lib/db/src/schema/network-clusters.ts)
- [Database Migration](artifacts/api-server/migrations/add_network_clusters.sql)

---

**Last Updated:** May 21, 2026  
**Status:** Production Ready
