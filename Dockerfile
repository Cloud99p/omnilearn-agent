# Dockerfile for OmniLearn API Server
# Deploy to Railway, Render, or any Docker host

FROM node:24-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/integrations-anthropic-ai/package.json ./lib/integrations-anthropic-ai/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy source code
COPY artifacts/api-server ./artifacts/api-server
COPY lib/db ./lib/db
COPY lib/api-zod ./lib/api-zod
COPY lib/integrations-anthropic-ai ./lib/integrations-anthropic-ai

# Build the API server
RUN pnpm --filter @workspace/api-server run build

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the server
CMD ["pnpm", "--filter", "@workspace/api-server", "run", "start"]
