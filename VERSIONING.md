# OmniLearn Versioning

## Current Version: **v3.0.1** (Development)

**Release Date:** May 23, 2026  
**Code Name:** "Context Awareness Optimization"  
**Live Deployment:** [workspaceapi-server-production-29ee.up.railway.app](https://workspaceapi-server-production-29ee.up.railway.app)

---

### v3.0.1 (May 23, 2026) - **Context Awareness Optimization** 🔍

**Bug Fixes & Improvements:**

- ✅ **Improved Knowledge Retrieval Threshold**
  - Similarity threshold adjusted to 0.2 (balanced filtering)
  - Better focus without losing conversational flow
  - Filters out very weak matches while maintaining context richness

- ✅ **Enhanced FreeLLM Context Integration**
  - Explicit instructions for LLM to prioritize knowledge base facts
  - Added similarity percentages to help LLM weigh retrieved facts
  - Clearer prompt structure: "IMPORTANT: Use the facts below to answer"

- ✅ **Better Logging & Debugging**
  - Added detailed context logging in chat endpoint
  - Logs query, nodes retrieved, top similarity score, node content
  - Easier to track what knowledge is being used in responses

- ✅ **Fixed Rate Limiting (429 errors)**
  - Set `trustProxy: true` in rate limiters
  - Added 30s cache to `/api/ghost/status` endpoint
  - Railway proxy now properly handled

**Files Changed:**
- `artifacts/api-server/src/brain/index.ts` - MIN_SIMILARITY threshold
- `artifacts/api-server/src/lib/free-llm.ts` - Contextual prompt improvement
- `artifacts/api-server/src/routes/omni/chat.ts` - Logging & extraction improvements
- `artifacts/api-server/src/middlewares/rateLimit.ts` - trustProxy fix
- `artifacts/api-server/src/routes/ghost/nodes.ts` - Cache added

**Impact:** Better context awareness, fewer irrelevant responses, improved rate limiting, easier debugging.

---

## Version Structure

OmniLearn uses **Semantic Versioning** (SemVer): `MAJOR.MINOR.PATCH`

### Version Components

| Component | When to Increment                      | Example           |
| --------- | -------------------------------------- | ----------------- |
| **MAJOR** | Breaking changes, architecture changes | `1.0.0` → `2.0.0` |
| **MINOR** | New features, backward-compatible      | `1.0.0` → `1.1.0` |
| **PATCH** | Bug fixes, performance improvements    | `1.0.0` → `1.0.1` |

---

## Package Versions

All packages are versioned together (monorepo):

| Package                        | Version | Description                          |
| ------------------------------ | ------- | ------------------------------------ |
| `omnilearn-agent` (root)       | `3.0.0` | Main repository                      |
| `@omnilearn/frontend`          | `1.0.0` | React + Vite frontend                |
| `@omnilearn/api-server`        | `3.0.0` | Express 5 API server                 |
| `@omnilearn/network-hierarchy` | `1.0.0` | 7-tier mesh network (production)     |

---

## Release History

### v3.0.0 (May 21, 2026) - **Planetary Intelligence Foundation** 🌐

**Major Features:**

- ✅ **7-Tier Mesh Network - Production Ready**
  - Database persistence for all cluster state (PostgreSQL)
  - WebSocket discovery server (port 8765) for real-time node communication
  - Secret key authentication for node registration
  - Heartbeat tracking and monitoring
  - Auto-cluster formation at 50 nodes within 50km radius
  - Hierarchical routing (Tier 1-7)

- ✅ **Hybrid LLM Intelligence**
  - FreeLLMAPI integration (5 providers: Gemini, Groq, Cerebras, OpenRouter, Mistral)
  - Configurable fallback rate (default 30%)
  - Training data collection pipeline for native synthesizer improvement
  - ~100M+ tokens/month combined free capacity

- ✅ **Two-Stage Vector Retrieval**
  - TF-IDF filters to top 100 candidates
  - Embedding re-ranks for precision
  - 100x scalability improvement (10K → 100K+ nodes)

- ✅ **AGPL v3 License**
  - Protects innovations from closed-source exploitation
  - Cloud-proof against AWS/Google SaaS exploitation
  - Brain + Mouth architecture preserved

**Files Changed:**
- `packages/network-hierarchy/src/cluster-manager.ts` - Pure in-memory algorithms
- `artifacts/api-server/src/lib/network-service.ts` - Database persistence layer
- `artifacts/api-server/src/lib/discovery-server.ts` - WebSocket server
- `artifacts/api-server/src/routes/omni/chat.ts` - Hybrid chat endpoint
- `lib/db/src/schema/network-clusters.ts` - 4 new tables (clusters, ghost_nodes, heartbeats, routing)
- `lib/db/src/schema/training-logs.ts` - Training log schema
- `artifacts/api-server/src/lib/free-llm.ts` - FreeLLMAPI client
- `Dockerfile` - node:24-slim, pnpm --dangerously-allow-all-builds

**Breaking Changes:**
- ClusterManager API now async (uses database)
- Database migration required (4 new tables)
- New environment variables: `DISCOVERY_PORT`, `CLUSTER_DISCOVERY_RADIUS_KM`, `CLUSTER_MIN_NODES`, `NODE_REGISTRATION_ENABLED`, `NODE_REGISTRATION_AUTH_REQUIRED`

**Infrastructure:**
- API Server: Railway (auto-deploys from GitHub)
- Frontend: Vercel (https://omnilearn.dpdns.org)
- Database: Supabase PostgreSQL
- WebSocket Discovery: Port 8765

**Impact:** Network state survives server restarts. Real multi-node deployment now possible. Zero-cost LLM fallback active.

---

### v1.0.0 (May 9, 2026) - **Stable Release** 🎉

**Major Features:**

- ✅ Production deployment (Vercel + Railway + Supabase)
- ✅ Google OAuth authentication
- ✅ Hebbian learning with SHA-256 proof chains
- ✅ Ontology self-reflection
- ✅ 7 evolving personality traits
- ✅ TF-IDF semantic retrieval
- ✅ Ghost Node distributed network
- ✅ **7-tier hierarchical network architecture** (NEW)
- ✅ Local AI synthesizer (no external API costs)

**Infrastructure:**

- Frontend: Vercel (https://omnilearn.dpdns.org)
- Backend: Railway (https://workspaceapi-server-production-29ee.up.railway.app)
- Database: Supabase (PostgreSQL, free tier)
- Ghost Node: Cloudflare Tunnel (https://ghost.omnilearn.dpdns.org)

**Network Architecture:**

- Tier 1: Individual Node (1 agent)
- Tier 2: Local Cluster (50 nodes, 50km)
- Tier 3: Metro Network (250 nodes, 200km)
- Tier 4: Regional Network (2.5K nodes, 1000km)
- Tier 5: Continental Backbone (50K nodes, 5000km)
- Tier 6: Global Mesh (200K+ nodes)
- Tier 7: Planetary Intelligence (emergent)

---

### v0.9.0-rc.4 (May 8, 2026) - Release Candidate 4

**Last RC before stable:**

- Fixed identity detection across sessions
- Enhanced health monitoring
- CI/CD pipeline complete
- Production deployment tested

---

### v0.8.0 (May 7, 2026) - Beta

**Production deployment:**

- Deployed to Vercel + Railway + Supabase
- Google OAuth configured
- Health check endpoints
- Security headers

---

### v0.7.0 (May 6, 2026) - Alpha

**Build pipeline:**

- Fixed monorepo build issues
- Added code splitting
- TypeScript errors resolved
- CI workflow created

---

### v0.1.0-v0.6.0 (May 5, 2026) - Early Development

**Initial development:**

- Core architecture designed
- Hebbian learning implemented
- Character engine built
- Knowledge graph created

---

## API Versioning

### Current API Version: **v1** (unversioned - default)

API endpoints are currently unversioned (default to v1):

```
GET /api/healthz
GET /api/omni/knowledge/stats
POST /api/omni/chat
```

### Future API Versioning (v2+)

When breaking changes are needed, we'll version the API:

```
GET /api/v1/healthz
GET /api/v2/healthz  (breaking changes)
```

**Version negotiation:**

- Default: v1 (unversioned endpoints)
- Header: `Accept: application/vnd.omnilearn.v2+json`
- URL prefix: `/api/v2/...`

---

## Feature Flags

| Feature              | Version Introduced | Status                        |
| -------------------- | ------------------ | ----------------------------- |
| Hebbian Learning     | v0.5.0             | ✅ Stable                     |
| Ontology Reflection  | v0.6.0             | ⚠️ Disabled (needs DB schema) |
| Ghost Network        | v0.9.0             | ✅ Stable                     |
| 7-Tier Hierarchy     | v1.0.0             | 🟡 Beta (0.1.0 package)       |
| Local AI Synthesizer | v1.0.0             | ✅ Stable                     |

---

## Upgrade Guide

### Upgrading to v1.0.0

**Breaking Changes:** None (first stable release)

**New Requirements:**

- Node.js 24.x (was 18.x)
- pnpm 10.x (was 9.x)
- PostgreSQL 15+ (Supabase free tier)

**Migration Steps:**

```bash
# 1. Update dependencies
pnpm install

# 2. Push DB schema (if changed)
pnpm run db:push

# 3. Deploy
git push origin main
```

**Environment Variables:**

```bash
# Required
DATABASE_URL=postgresql://...
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Optional (for Ghost Node)
GHOST_NODE_SECRET=your-secret-key
```

---

## Release Process

### 1. Development → Release Candidate

```bash
# Update version in package.json files
# Update VERSION.md
# Tag release candidate
git tag v1.1.0-rc.1
git push origin v1.1.0-rc.1
```

### 2. Testing (1-2 weeks)

- Test on staging
- Monitor error rates (Sentry)
- Check uptime (UptimeRobot)
- User feedback

### 3. Release Candidate → Stable

```bash
# Update version to stable
# Update VERSION.md with release notes
# Tag stable release
git tag v1.1.0
git push origin v1.1.0
```

### 4. Deploy

- Vercel auto-deploys on push
- Railway auto-deploys on push
- Update documentation

---

## Version Display

The version is displayed in the UI:

- **Home page:** Top badge shows `v1.0.0 / Stable Release`
- **API health:** `/api/healthz` returns version in response
- **Footer:** Copyright with version number

---

## Support Policy

| Version | Support Status | End of Life |
| ------- | -------------- | ----------- |
| v1.0.x  | ✅ Current     | N/A         |
| v0.9.x  | ⚠️ Deprecated  | June 2026   |
| v0.8.x  | ❌ End of Life | May 2026    |
| <v0.8   | ❌ Unsupported | N/A         |

**Support includes:**

- Security patches
- Critical bug fixes
- Documentation updates

---

## Roadmap

### v1.1.0 (Q3 2026)

- Hierarchical network Phase 2 (Metro clustering)
- Knowledge aggregation up the hierarchy
- Visual network topology diagram

### v1.2.0 (Q4 2026)

- Regional network formation
- Cross-cluster routing
- Load balancing

### v2.0.0 (2027)

- Continental backbone (Tier 5)
- Global mesh (Tier 6)
- Planetary intelligence emergence (Tier 7)

---

**Last Updated:** May 9, 2026  
**Maintained By:** OmniLearn Core Team
