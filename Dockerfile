FROM node:24-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy workspace files first (for better caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all workspace package.json files
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/
COPY artifacts/omnilearn/package.json ./artifacts/omnilearn/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/
COPY lib/integrations-anthropic-ai/package.json ./lib/integrations-anthropic-ai/
COPY packages/network-hierarchy/package.json ./packages/network-hierarchy/
COPY scripts/package.json ./scripts/

# Install dependencies
RUN pnpm install

# Copy rest of code
COPY . .

# Build if needed
RUN cd artifacts/api-server && pnpm build || true

# Set working directory
WORKDIR /app/artifacts/api-server

# Expose port
EXPOSE 3000

# Start server
CMD ["pnpm", "start"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
