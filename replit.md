# OmniLearn Workspace

## Overview

pnpm workspace monorepo using TypeScript. OmniLearn is an open-source AI agent project hub with real AI chat, account management, and GitHub repository integration.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Clerk (Replit-managed) — Google + GitHub OAuth
- **AI**: Anthropic claude-sonnet-4-5 via Replit AI Integrations (SSE streaming)
- **Frontend**: React + Vite + Tailwind v4 + shadcn/ui + framer-motion + wouter routing

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Architecture

```
artifacts/
  omnilearn/       # React + Vite frontend (path: /)
  api-server/      # Express API (path: /api)
  mockup-sandbox/  # Component preview server

lib/
  db/              # Drizzle schema + migrations
  api-spec/        # OpenAPI spec
  api-zod/         # Generated Zod schemas
  api-client-react/ # Generated React Query hooks
  integrations-anthropic-ai/ # Anthropic client
```

## Database Schema

- `users` — Clerk user ID, display name, avatar, GitHub username
- `conversations` — AI chat conversations (clerkId, title, mode)
- `messages` — Chat messages (conversationId, role, content)
- `skills` — Agent skills / system prompt extensions (clerkId, name, systemPrompt)
- `repositories` — Saved GitHub repositories (clerkId, repoFullName)
- `knowledge_nodes` — Local AI knowledge graph nodes (TF-IDF based, per instance)
- `knowledge_edges` — Typed edges between knowledge nodes (causes/enables/is-a)
- `character_state` — AI personality trait state (curiosity, caution, confidence, etc.)
- `learning_log` — Local learning events log
- `ghost_nodes` — Registered remote ghost node machines
- `network_neurons` — Shared distributed neural network knowledge (Hebbian weights, multi-agent)
- `network_synapses` — Weighted connections between network neurons (Hebbian learning)
- `network_agents` — Contributing agents (ghost nodes + self) with trust scores
- `network_pulses` — Live activity log (contribute / reinforce / decay / query / sync / emerge)
- `hebbian_proposals` — Cryptographically-proven Hebbian reinforcement proposals (pending → validated → applied)
- `ontology_nodes` — OntologyNode meta-nodes: edge vocabulary, structural rules, constraints
- `ontology_proposals` — Meta-operation proposals (new-edge-type / split-node / merge-nodes / demote-rule)

## API Routes

### Core

| Route                                                 | Auth     | Description                             |
| ----------------------------------------------------- | -------- | --------------------------------------- |
| GET /api/healthz                                      | —        | Health check                            |
| GET /api/me                                           | Required | Current user profile (upserted into DB) |
| GET /api/anthropic/conversations                      | —        | List conversations                      |
| POST /api/anthropic/conversations                     | —        | Create conversation                     |
| DELETE /api/anthropic/conversations/:id               | —        | Delete conversation                     |
| POST /api/anthropic/conversations/:id/messages/stream | —        | SSE streaming chat                      |
| GET /api/skills                                       | —        | List skills                             |
| POST /api/skills                                      | —        | Create skill                            |
| DELETE /api/skills/:id                                | —        | Delete skill                            |
| GET /api/github/status                                | Required | GitHub connection status                |
| GET /api/github/repos                                 | Required | List user's GitHub repos                |
| GET /api/github/repos/search                          | Required | Search GitHub repos                     |
| POST /api/github/repos                                | Required | Create new repo                         |
| POST /api/github/repos/:owner/:repo/fork              | Required | Fork a repo                             |
| GET /api/github/repos/:owner/:repo/contents           | Required | Browse repo files                       |
| POST /api/github/share                                | Required | Share config as GitHub Gist             |

## Authentication (Clerk)

- Provisioned via Replit-managed Clerk (`setupClerkWhitelabelAuth`)
- Keys: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`
- Google OAuth enabled by default
- **To enable GitHub OAuth**: open the Auth pane in the workspace toolbar → enable GitHub
- Sign-in: `/sign-in` — Sign-up: `/sign-up`
- Protected routes: `/account`, `/repositories` (redirect to /sign-in when signed out)
- Server auth middleware: `requireAuth` (`artifacts/api-server/src/middlewares/requireAuth.ts`)
- GitHub token retrieval: `clerkClient.users.getUserOauthAccessToken(userId, 'oauth_github')`

## Frontend Pages

| Route          | Auth     | Description                                  |
| -------------- | -------- | -------------------------------------------- |
| /              | Public   | Home / hero page                             |
| /onboarding    | Public   | Get Started guide                            |
| /chat          | Public\* | AI agent chat (\* requires login to persist) |
| /personality   | Public   | Personality configuration                    |
| /architecture  | Public   | System architecture                          |
| /network       | Public   | Distributed computing                        |
| /dna           | Public   | Instance DNA                                 |
| /compare       | Public   | Compare instances                            |
| /ingestion     | Public   | Data ingestion                               |
| /storage       | Public   | Storage management                           |
| /memory        | Public   | Memory system                                |
| /compliance    | Public   | Compliance layer                             |
| /configuration | Public   | Configuration                                |
| /components    | Public   | Components reference                         |
| /governance    | Public   | Governance                                   |
| /sign-in       | Public   | Clerk sign-in (Google + GitHub OAuth)        |
| /sign-up       | Public   | Clerk sign-up                                |
| /account       | Auth     | User profile + connected accounts            |
| /repositories  | Auth     | GitHub repository browser                    |

## Clerk Appearance

Dark theme matching OmniLearn brand:

- Primary: `#22d3ee` (electric cyan)
- Background: `#0f172a` (deep navy)
- Font: JetBrains Mono / Fira Code (monospace)
- Theme base: `shadcn` from `@clerk/themes`
- Tailwind v4: `cssLayerName: "clerk"`, `optimize: false` in vite.config.ts

## User Preferences

- No emojis in output
- No "copyright stays on the internet" framing
- Ghost mode = own device mobility only (not network crawling)
- No suggest_next_ideas at end of responses
