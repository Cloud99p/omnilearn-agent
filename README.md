# OmniLearn Agent

**Created by:** Emmanuel Nenpan Hosea  
**License:** AGPL v3

An open-source AI agent with persistent knowledge graphs, evolving character, and distributed neural network capabilities.

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

## 📁 Project Structure

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

## 📚 Documentation

| Document | Purpose |
|----------|----------|
| **[WHAT_WORKS_NOW.md](WHAT_WORKS_NOW.md)** | What's actually shipped today (start here!) |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Complete deployment guide |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System architecture including 7-tier network |
| **[ROADMAP.md](ROADMAP.md)** | Development timeline |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | How to contribute |

## 🧠 Core Features

### Persistent Knowledge Graph

- **Hybrid retrieval:** TF-IDF (fast filtering) + Embeddings (semantic re-ranking)
- **Embeddings:** @xenova/transformers with all-MiniLM-L6-v2 (384-dim, fast, no GPU)
- **Two-stage retrieval:** Scales to 100K+ nodes (TF-IDF filters to top 100, then embedding re-ranks)
- Hebbian learning with cryptographic proof chains
- Ontology self-reflection (merge/split/demote proposals)

### Evolving Character

- 7 evolving personality traits: **curiosity, caution, confidence, verbosity, technical, empathy, creativity**
- Traits range 0-100 and evolve based on conversation patterns
- Influences response tone, depth, and style
- Survives across sessions (persistent character state)

### Distributed Neural Network

- Multi-agent knowledge sharing
- Synaptic decay and reinforcement
- Core neuron emergence

### 🌐 Hierarchical Network Architecture (Q3-Q4 2026)

- **7-tier self-organizing mesh network**
- **Tier 1**: Individual Node (1 agent)
- **Tier 2**: Local Cluster (50 nodes in 50km - city-wide)
- **Tier 3**: Metro Network (5 clusters in 200km - metro area)
- **Tier 4**: Regional Network (10 metros in 1000km - state/national)
- **Tier 5**: Continental Backbone (20 regions in 5000km - continent)
- **Tier 6**: Global Mesh (4 continents in 20000km - planetary)
- **Tier 7**: Planetary Intelligence (emergent consciousness)
- Auto-clustering by geographic proximity
- Self-healing routing around failures
- Knowledge aggregation up the hierarchy

### Real-time Web Access

- DuckDuckGo web search
- URL content fetching
- SSE streaming responses

## 🔧 Environment Variables

| Variable                     | Required | Description                            |
| ---------------------------- | -------- | -------------------------------------- |
| `DATABASE_URL`               | ✅       | PostgreSQL connection string           |
| `CLERK_SECRET_KEY`           | ✅       | Clerk API secret key                   |
| `CLERK_PUBLISHABLE_KEY`      | ✅       | Clerk publishable key                  |
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅       | Client-side Clerk key                  |
| `FREELLM_API_KEY`            | ✅       | FreeLLM unified API key (Groq, Gemini, Mistral, Cerebras) |
| `USE_LLM_FALLBACK`           | ❌       | Enable hybrid mode (`true`/`false`)    |
| `LLM_FALLBACK_RATE`          | ❌       | LLM fallback rate (default: `0.3`)     |
| `FREELLM_API_URL`            | ❌       | FreeLLMAPI endpoint URL                |
| `FREELLM_API_KEY`            | ❌       | FreeLLMAPI API key                     |
| `GITHUB_TOKEN`               | ❌       | GitHub OAuth token (for repo features) |
| `PORT`                       | ❌       | Server port (default: 3000)            |
| `BASE_PATH`                  | ❌       | Base path for deployment (default: /)  |

## 📦 Commands

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

## 🏗️ Architecture

### Knowledge Processing Pipeline

1. **User Input** → Extract facts via `extractor.ts`
2. **Semantic Search** → TF-IDF retrieval from `knowledge_nodes`
3. **Web Lookup** → Optional real-time search via `web-tools.ts`
4. **Response Synthesis** → Native synthesizer + optional FreeLLM fallback
5. **Learning** → Insert new nodes, propose Hebbian edges
6. **Character Update** → Evolve personality traits

### Hebbian Learning Flow

```
New Knowledge → Propose Edge → Cryptographic Proof → 5 Validators → Apply/Reject
                                      ↓
                    (evidence hash + SHA-256 proof)
```

### Ontology Reflection Cycle

Runs every 10 minutes:

1. Scan for novel edge types → propose registration
2. Find low-confidence rules → propose demotion
3. Detect duplicate concepts → propose merge
4. Identify over-broad nodes → propose split

## 🗄️ Database Schema

| Table                                   | Purpose                        |
| --------------------------------------- | ------------------------------ |
| `knowledge_nodes` + `knowledge_edges`   | Local knowledge graph          |
| `hebbian_proposals`                     | Pending edge mutations         |
| `character_state`                       | Personality traits + evolution |
| `network_neurons` + `network_synapses`  | Distributed neural network     |
| `ontology_nodes` + `ontology_proposals` | Meta-ontology management       |
| `conversations` + `messages`            | Chat history                   |

## 🚀 Deployment

For complete deployment instructions, see **[DEPLOYMENT.md](DEPLOYMENT.md)**.

Quick options:
- **Cloud (Recommended):** Vercel (frontend) + Railway (backend) + Supabase (database) — Free tier
- **Single Server:** Docker Compose on a $5/month VPS
- **Local Dev:** See [DEPLOYMENT.md](DEPLOYMENT.md) for setup

## 🧪 Development

### Running Tests

```bash
# TODO: Add test suite
pnpm run test
```

### Code Style

```bash
# Format code
pnpm prettier --write .

# Check types
pnpm run typecheck
```

## 📚 API Documentation

API routes are documented in `lib/api-spec/openapi.yaml`.

Key endpoints:

- `POST /api/omni/chat` — SSE streaming chat (hybrid: native + LLM fallback)
- `GET /api/omni/knowledge` — Browse knowledge nodes
- `POST /api/omni/train` — Manual training
- `GET /api/omni/character` — Character state
- `POST /api/omni/benchmark` — Run intelligence benchmarks

## 🛡️ Rate Limiting

Rate limiting is enabled on all API endpoints using `express-rate-limit`:
- Default: 100 requests per 15 minutes per IP
- Configured in `artifacts/api-server/src/middlewares/rateLimit.ts`
- Trust proxy disabled (works behind Railway/Vercel proxies)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Requirements:**

- All PRs must pass CI (type check + build)
- Follow existing code style
- Update documentation for new features

## 📄 License

AGPL v3 License — see [LICENSE](LICENSE) for details.

**What this means:**
- You can use, modify, and distribute this code
- If you distribute modifications, you must open-source them
- If you run this as a service, you must open-source your modifications
- You cannot use this code in closed-source commercial products

For commercial licensing options, contact: emmanuelhosea09@gmail.com

## 🙏 Acknowledgments

- UI components from [shadcn/ui](https://ui.shadcn.com)
- ORM by [Drizzle](https://orm.drizzle.team)
- Embeddings by [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2)
- Hybrid LLM routing via [FreeLLM API](https://freellmapi.com)

# Redeploy trigger
