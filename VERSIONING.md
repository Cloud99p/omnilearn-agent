# OmniLearn Versioning

## Current Version: **v1.0.0** (Stable Release)

**Release Date:** May 9, 2026

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

| Package                        | Version | Description                |
| ------------------------------ | ------- | -------------------------- |
| `omnilearn-agent` (root)       | `1.0.0` | Main repository            |
| `@omnilearn/frontend`          | `1.0.0` | React + Vite frontend      |
| `@omnilearn/api-server`        | `1.0.0` | Express 5 API server       |
| `@omnilearn/network-hierarchy` | `0.1.0` | 7-tier mesh network (beta) |

---

## Release History

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
