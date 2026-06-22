# OmniLearn

**Building the infrastructure layer for AI + blockchain systems**

---

## 🚀 What is OmniLearn?

**OmniLearn is building the infrastructure layer for AI + blockchain systems.**

We create open-source tools that bridge artificial intelligence, distributed systems, and decentralized infrastructure. Our mission: make advanced AI accessible, auditable, and composable with Web3.

**Created by:** Emmanuel Nenpan Hosea  
**License:** AGPL v3

---

## 📦 Product Portfolio

### 1. **omnilearn-agent** (This Repo) ✅
An open-source AI agent with:
- Persistent knowledge graphs
- Evolving character system (7 personality traits)
- 7-tier distributed mesh network
- Hybrid retrieval (TF-IDF + embeddings)
- Hebbian learning with cryptographic proofs

**Status:** Production-ready

**Stack:** Node.js 24+, PostgreSQL, React + Vite, FreeLLM API

[📖 View Full Documentation](#documentation)

---

### 2. **solana-tx-stack** 🚧
Production-ready Jito MEV bundle infrastructure for Solana traders.
- AI-driven transaction bundling
- Dashboard monitoring
- Comprehensive testing suite
- Jito block engine integration

**Status:** Launching Q3 2026

**Use Case:** Traders, MEV searchers, Solana developers

[🔗 View on GitHub](https://github.com/Cloud99p/solana-tx-stack)

---

### 3. **AgentFlow** 🚧
AI-powered trading benchmark and execution system.
- 121+ integrated skills
- Self-evolution framework
- Multi-exchange support (OKX, HFM, Solana)
- Automated performance analysis
- Performance-based pricing (we win when you win)

**Status:** In development

**Use Case:** Crypto traders, quantitative analysts, trading firms

---

## 🏗️ Architecture

```
omnilearn-agent/
├── artifacts/
│   ├── omnilearn/        # React + Vite frontend
│   ├── api-server/       # Express 5 API server
│   └── mockup-sandbox/   # Component preview server
├── packages/
│   └── network-hierarchy/ # 7-tier mesh network infrastructure
├── lib/
│   ├── db/               # Drizzle ORM schema
│   ├── api-spec/         # OpenAPI specification
│   ├── api-zod/          # Generated Zod schemas
│   ├── api-client-react/ # Generated React Query hooks
│   └── integrations-anthropic-ai/
└── scripts/
```

---

## 🎯 Key Features

### 🧠 Hybrid Knowledge Retrieval
- **TF-IDF** (fast filtering) + **Embeddings** (semantic re-ranking)
- **Embeddings:** @xenova/transformers with all-MiniLM-L6-v2 (384-dim, fast, no GPU)
- **Two-stage retrieval:** Scales to 100K+ nodes (TF-IDF filters to top 100, then embedding re-ranks)

### 🧬 Evolving Character System
- **7 personality traits:** curiosity, caution, confidence, verbosity, technical, empathy, creativity
- **Traits range 0-100** and evolve based on conversation patterns
- **Influences response tone, depth, and style**
- **Survives across sessions** (persistent character state)

### 🌐 7-Tier Distributed Mesh Network
| Tier | Name | Scale | Description |
|------|------|-------|-------------|
| 1 | Individual Node | 1 agent | Single instance |
| 2 | Local Cluster | 50 nodes (50km) | City-wide |
| 3 | Metro Network | 5 clusters (200km) | Metro area |
| 4 | Regional Network | 10 metros (1000km) | State/national |
| 5 | Continental Backbone | 20 regions (5000km) | Continent |
| 6 | Global Mesh | 4 continents (20000km) | Planetary |
| 7 | Planetary Intelligence | Emergent | Global consciousness |

- **Auto-clustering** by geographic proximity
- **Self-healing routing** around failures
- **Knowledge aggregation** up the hierarchy

### ⛓️ Cryptographic Proof Chains
- **Hebbian learning** with cryptographic proof
- **Ontology self-reflection** (merge/split/demote proposals)
- **Multi-agent knowledge sharing**
- **Synaptic decay and reinforcement**
- **Core neuron emergence**

---

## 🚀 Quick Start

### Prerequisites
- Node.js 24+
- pnpm 10+
- PostgreSQL database

### Installation
```bash
# Clone the repository
git clone https://github.com/Cloud99p/omnilearn-agent.git
cd omnilearn-agent

# Install dependencies
pnpm install

# Set up environment variables (see .env.example)
cp .env.example .env

# Run database migrations
pnpm --filter @workspace/db run push

# Start development server
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/omnilearn run dev
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [WHAT_WORKS_NOW.md](WHAT_WORKS_NOW.md) | What's actually shipped today (start here!) |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Complete deployment guide including network migrations |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture including 7-tier network |
| [ROADMAP.md](ROADMAP.md) | Development timeline |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |
| [MIGRATIONS.md](MIGRATIONS.md) | Database migration guide |
| [VERSIONING.md](VERSIONING.md) | Version history and changelog |

---

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | ✅ | Clerk API secret key |
| `CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key |
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ | Client-side Clerk key |
| `FREELLM_API_KEY` | ✅ | FreeLLM unified API key (Groq, Gemini, Mistral, Cerebras) |
| `USE_LLM_FALLBACK` | ❌ | Enable hybrid mode (true/false) |
| `LLM_FALLBACK_RATE` | ❌ | LLM fallback rate (default: 0.3) |
| `GITHUB_TOKEN` | ❌ | GitHub OAuth token (for repo features) |
| `PORT` | ❌ | Server port (default: 3000) |

---

## 🛠️ Development Commands

```bash
# Full type check
pnpm run typecheck

# Build all packages
pnpm run build

# Regenerate API hooks from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema (development only)
pnpm --filter @workspace/db run push

# Run API server locally
pnpm --filter @workspace/api-server run dev

# Run frontend locally
pnpm --filter @workspace/omnilearn run dev
```

---

## 🔄 How It Works

```
User Input
    ↓
Extract facts (extractor.ts)
    ↓
Semantic Search (TF-IDF from knowledge_nodes)
    ↓
Web Lookup (optional, via web-tools.ts)
    ↓
Response Synthesis (native + FreeLLM fallback)
    ↓
Learning (insert nodes, propose Hebbian edges)
    ↓
Character Update (evolve personality traits)
```

### Knowledge Validation Flow
```
New Knowledge → Propose Edge → Cryptographic Proof → 5 Validators → Apply/Reject
                     ↓
          (evidence hash + SHA-256 proof)
```

### Ontology Self-Reflection (Every 10 minutes)
- Scan for novel edge types → propose registration
- Find low-confidence rules → propose demotion
- Detect duplicate concepts → propose merge
- Identify over-broad nodes → propose split

---

## 🗄️ Database Schema

| Table | Purpose |
|-------|---------|
| `knowledge_nodes` + `knowledge_edges` | Local knowledge graph |
| `hebbian_proposals` | Pending edge mutations |
| `character_state` | Personality traits + evolution |
| `network_neurons` + `network_synapses` | Distributed neural network |
| `ontology_nodes` + `ontology_proposals` | Meta-ontology management |
| `conversations` + `messages` | Chat history |

---

## 🚀 Deployment

### Quick Options

**Cloud (Recommended):**
- Frontend: Vercel (free tier)
- Backend: Railway (free tier)
- Database: Supabase (free tier)

**Single Server:**
- Docker Compose on a $5/month VPS

**Local Development:**
- See [DEPLOYMENT.md](DEPLOYMENT.md) for full setup

---

## 📡 API Reference

API routes are documented in `lib/api-spec/openapi.yaml`.

**Key Endpoints:**

| Endpoint | Description |
|----------|-------------|
| `POST /api/omni/chat` | SSE streaming chat (hybrid: native + LLM fallback) |
| `GET /api/omni/knowledge` | Browse knowledge nodes |
| `POST /api/omni/train` | Manual training |
| `GET /api/omni/character` | Character state |
| `POST /api/omni/benchmark` | Run intelligence benchmarks |

### Rate Limiting
- **Default:** 100 requests per 15 minutes per IP
- **Configured in:** `artifacts/api-server/src/middlewares/rateLimit.ts`
- **Trust proxy disabled** (works behind Vercel/Railway proxies)

---

## 🤝 Contributing

We welcome contributions!

```bash
# Fork the repository
# Create a feature branch
git checkout -b feature/amazing-feature

# Commit your changes
git commit -m 'Add amazing feature'

# Push to the branch
git push origin feature/amazing-feature

# Open a Pull Request
```

**Requirements:**
- All PRs must pass CI (type check + build)
- Follow existing code style
- Update documentation for new features

---

## 📝 License

**AGPL v3** — see [LICENSE](LICENSE) for details.

### What This Means:
- ✅ You can use, modify, and distribute this code
- ✅ If you distribute modifications, you must open-source them
- ✅ If you run this as a service, you must open-source your modifications
- ❌ You cannot use this code in closed-source commercial products

### Commercial Licensing

Need to use Omnilearn in a **closed-source product** or **proprietary SaaS**?

We offer commercial licenses for companies that need:
- ✅ Closed-source usage (don't open-source your modifications)
- ✅ White-label rights (rebrand as your own)
- ✅ OEM licensing (embed in your product)
- ✅ Enterprise support & SLA

**License Tiers:**
- **Startup License:** $7,500 one-time (teams <50, revenue <$1M)
- **Enterprise License:** $35,000 + $2,500/month (unlimited deployments)
- **OEM/White-Label:** $75,000 + revenue share (embed & resell)
- **Unlimited/Perpetual:** Custom pricing (starting at $250K)

**Includes:**
- Legal compliance (bypass AGPL requirements)
- Modification rights
- Priority support
- Updates & bug fixes
- Deployment assistance

📧 **Contact:** emmanuelhosea09@gmail.com  
📄 **Full Details:** [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md)

---

### Free for Everyone Who Needs It

Omnilearn is **open source (AGPL v3)** and free forever for:
- ✅ Individuals
- ✅ Students & researchers
- ✅ Non-profits
- ✅ Open-source projects
- ✅ Companies using it internally

**Learn more:** [Licensing Options](LICENSE-COMMERCIAL.md)

---

## 🎯 Roadmap

### Q2 2026
- [ ] Network stability improvements
- [ ] Frontend UX enhancements
- [ ] Knowledge graph visualization

### Q3 2026
- [ ] **solana-tx-stack launch** (Jito MEV infrastructure)
- [ ] **AgentFlow beta** (AI trading benchmark system)
- [ ] Omnilearn unified dashboard

### Q4 2026
- [ ] Multi-agent coordination improvements
- [ ] Enhanced ontology self-reflection
- [ ] Enterprise features (SSO, audit logs, SLA)

---

## 🙏 Acknowledgments

- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Embeddings from [@xenova/transformers](https://github.com/xenova/transformers.js)
- API tooling from [Drizzle ORM](https://orm.drizzle.team/)

---

## 🔗 Links

[GitHub](https://github.com/Cloud99p) • [Website](https://omnilearn.dpdns.org/) • [Email](mailto:emmanuelhosea09@gmail.com)

---

**Built with ❤️ by Emmanuel Nenpan Hosea**
