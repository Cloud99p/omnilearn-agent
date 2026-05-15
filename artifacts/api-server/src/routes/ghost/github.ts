import { Router } from "express";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../../middlewares/requireAuth.js";
import { createClerkClient } from "@clerk/express";
import { Octokit } from "@octokit/rest";

const router = Router();
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function getGitHubToken(clerkId: string): Promise<string | null> {
  try {
    const tokens = await clerkClient.users.getUserOauthAccessToken(
      clerkId,
      "oauth_github",
    );
    return tokens.data?.[0]?.token ?? null;
  } catch {
    return null;
  }
}

function b64(str: string): string {
  return Buffer.from(str, "utf-8").toString("base64");
}

const README = `# OmniLearn Ghost Node

A distributed compute node for the [OmniLearn](https://github.com) AI agent network.

Ghost nodes extend the OmniLearn network by providing additional processing capacity. Your primary OmniLearn instance routes tasks to registered ghost nodes when operating in Ghost Mode.

## Quick Start

### Option 1 — Docker (recommended)

\`\`\`bash
docker compose up -d
\`\`\`

### Option 2 — Node.js (manual)

\`\`\`bash
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
\`\`\`

### Option 3 — One-liner

\`\`\`bash
GHOST_NODE_SECRET=your-secret ANTHROPIC_API_KEY=your-key PORT=8080 node ghost-server.js
\`\`\`

## Configuration

Copy \`.env.example\` to \`.env\` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| \`GHOST_NODE_SECRET\` | Yes | Shared secret — must match what you enter in OmniLearn when registering this node |
| \`ANTHROPIC_API_KEY\` | Yes | Your Anthropic API key for Claude access |
| \`PORT\` | No | Port to listen on (default: 8080) |
| \`GHOST_NODE_NAME\` | No | Human-readable name shown in OmniLearn dashboard |
| \`GHOST_NODE_REGION\` | No | Region label (e.g. eu-west, us-east) |

## Registering the Node

Once running, add it in OmniLearn:

1. Open **Ghost Network** in the sidebar
2. Click **Add Node**
3. Enter your node's public URL (e.g. \`https://your-server.com\`) and the secret you set
4. Click **Connect** — OmniLearn will ping it to verify

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/api/ghost/health\` | Health check (no auth required) |
| POST | \`/api/ghost/execute\` | Execute a task (requires \`X-Ghost-Secret\` header) |

## Security

- All task requests require the \`X-Ghost-Secret\` header matching \`GHOST_NODE_SECRET\`
- Never share your secret key or commit \`.env\` to version control
- Use HTTPS in production (set up a reverse proxy with nginx or Caddy)

## Architecture

\`\`\`
Primary OmniLearn ──── Ghost Mode Chat ───► Node Registry
                                                │
                              ┌─────────────────┼─────────────────┐
                              ▼                 ▼                 ▼
                         Ghost Node 1      Ghost Node 2      Ghost Node N
                         (this server)     (another server)  (cloud instance)
\`\`\`
`;

const GHOST_SERVER_JS = `#!/usr/bin/env node
// OmniLearn Ghost Node Server
// Accepts distributed tasks from the primary OmniLearn instance

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;
const SECRET = process.env.GHOST_NODE_SECRET;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const NODE_NAME = process.env.GHOST_NODE_NAME || 'Ghost Node';
const REGION = process.env.GHOST_NODE_REGION || 'unknown';

if (!SECRET) { console.error('[ghost-node] ERROR: GHOST_NODE_SECRET is required'); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error('[ghost-node] ERROR: ANTHROPIC_API_KEY is required'); process.exit(1); }

let Anthropic;
try { Anthropic = require('@anthropic-ai/sdk'); } catch {
  console.error('[ghost-node] ERROR: Run "npm install" first');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health check — called by primary OmniLearn to verify liveness
app.get('/api/ghost/health', (req, res) => {
  res.json({
    status: 'online',
    name: NODE_NAME,
    region: REGION,
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Execute task — receives work from primary OmniLearn instance
app.post('/api/ghost/execute', async (req, res) => {
  const incomingSecret = req.headers['x-ghost-secret'];
  if (!incomingSecret || incomingSecret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { message, history = [], systemPrompt, requestId } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });

  const startTime = Date.now();
  console.log(\`[ghost-node] Executing task \${requestId || '?'} — "\${message.slice(0, 60)}"\`);

  try {
    const messages = [...history, { role: 'user', content: message }];
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt || 'You are Omni, the AI agent built by Emmanuel Nenpan Hosea, creator of OmniLearn. You are running as a distributed ghost node.',
      messages,
    });

    const text = response.content.find(c => c.type === 'text')?.text || '';
    const processingMs = Date.now() - startTime;
    console.log(\`[ghost-node] Task \${requestId || '?'} completed in \${processingMs}ms\`);

    res.json({ response: text, model: response.model, processingMs, requestId, nodeName: NODE_NAME });
  } catch (err) {
    console.error(\`[ghost-node] Task \${requestId || '?'} failed:\`, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(\`\\n  OmniLearn Ghost Node "\${NODE_NAME}" (region: \${REGION})\`);
  console.log(\`  Listening on port \${PORT}\`);
  console.log(\`  Health: http://localhost:\${PORT}/api/ghost/health\\n\`);
});
`;

const DOCKER_COMPOSE = `version: '3.8'

services:
  ghost-node:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - .:/app
    environment:
      - GHOST_NODE_SECRET=\${GHOST_NODE_SECRET}
      - ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY}
      - PORT=\${PORT:-8080}
      - GHOST_NODE_NAME=\${GHOST_NODE_NAME:-Ghost Node}
      - GHOST_NODE_REGION=\${GHOST_NODE_REGION:-unknown}
    command: sh -c "npm install --production && node ghost-server.js"
    ports:
      - "\${PORT:-8080}:\${PORT:-8080}"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:\${PORT:-8080}/api/ghost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
`;

const ENV_EXAMPLE = `# OmniLearn Ghost Node — Environment Variables

# REQUIRED: Shared secret between this node and the primary OmniLearn instance
# Must match the secret you enter when registering this node in OmniLearn
GHOST_NODE_SECRET=change-me-to-something-secure

# REQUIRED: Your Anthropic API key (used to run Claude on this node)
ANTHROPIC_API_KEY=sk-ant-...

# OPTIONAL: Port to listen on (default: 8080)
PORT=8080

# OPTIONAL: Human-readable name shown in OmniLearn Ghost Network dashboard
GHOST_NODE_NAME=My Ghost Node

# OPTIONAL: Region label for display in OmniLearn (e.g. eu-west, us-east, home-lab)
GHOST_NODE_REGION=unknown
`;

const PACKAGE_JSON = JSON.stringify(
  {
    name: "omnilearn-ghost-node",
    version: "1.0.0",
    description: "OmniLearn distributed ghost node server",
    main: "ghost-server.js",
    scripts: { start: "node ghost-server.js" },
    dependencies: {
      "@anthropic-ai/sdk": "^0.32.0",
      cors: "^2.8.5",
      express: "^4.21.0",
    },
    engines: { node: ">=18" },
  },
  null,
  2,
);

const GITIGNORE = `.env
node_modules/
*.log
`;

router.post("/github/create-repo", requireAuth, async (req, res) => {
  const clerkId = (req as AuthenticatedRequest).clerkId;
  const token = await getGitHubToken(clerkId);

  if (!token) {
    res.status(403).json({
      error: "GitHub account not connected.",
      hint: "Sign in with GitHub via your Account page, then try again.",
    });
    return;
  }

  const {
    repoName = "omnilearn-ghost-node",
    description = "OmniLearn distributed ghost node server",
    isPrivate = false,
  } = req.body as {
    repoName?: string;
    description?: string;
    isPrivate?: boolean;
  };

  const octokit = new Octokit({ auth: token });

  try {
    // Create the repository
    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      description,
      private: isPrivate,
      auto_init: false,
    });

    // Push all files
    const files: Array<{ path: string; content: string; message: string }> = [
      { path: "README.md", content: README, message: "Add README" },
      {
        path: "ghost-server.js",
        content: GHOST_SERVER_JS,
        message: "Add ghost node server",
      },
      {
        path: "docker-compose.yml",
        content: DOCKER_COMPOSE,
        message: "Add Docker Compose config",
      },
      {
        path: ".env.example",
        content: ENV_EXAMPLE,
        message: "Add example environment file",
      },
      {
        path: "package.json",
        content: PACKAGE_JSON,
        message: "Add package.json",
      },
      { path: ".gitignore", content: GITIGNORE, message: "Add .gitignore" },
    ];

    let treeSha: string | undefined;
    let commitSha: string | undefined;

    for (const file of files) {
      try {
        await octokit.repos.createOrUpdateFileContents({
          owner: repo.owner.login,
          repo: repo.name,
          path: file.path,
          message: `chore: ${file.message}`,
          content: b64(file.content),
          ...(commitSha ? { sha: commitSha } : {}),
        });
      } catch {
        // File might already exist on subsequent pushes
      }
    }

    res.json({
      success: true,
      repo: {
        name: repo.name,
        fullName: repo.full_name,
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        private: repo.private,
      },
      message: `Ghost node repository "${repo.full_name}" created with all deployment files.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("already exists")) {
      res
        .status(409)
        .json({
          error: `Repository "${repoName}" already exists on your GitHub account.`,
        });
    } else {
      req.log.error(err, "Failed to create ghost node repo");
      res
        .status(500)
        .json({ error: "Failed to create repository", detail: message });
    }
  }
});

export default router;
