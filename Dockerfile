# Dockerfile for OmniLearn API Server
# Deploy to Render, Railway, or any Docker host

FROM node:24-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

# Set working directory
WORKDIR /app

# Copy package files (for dependency installation)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/integrations-anthropic-ai/package.json ./lib/integrations-anthropic-ai/

# Install all dependencies (including dev for tsx)
RUN pnpm install

# Install tsx globally for running TypeScript
RUN pnpm add -g tsx

# Copy source code
COPY artifacts/api-server ./artifacts/api-server
COPY lib/db ./lib/db
COPY lib/api-zod ./lib/api-zod
COPY lib/integrations-anthropic-ai ./lib/integrations-anthropic-ai

# Build the API server (runs typecheck + build)
RUN pnpm --filter @workspace/api-server run build

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the server
CMD ["pnpm", "--filter", "@workspace/api-server", "run", "start"]
