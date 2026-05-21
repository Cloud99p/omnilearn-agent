FROM node:24-slim

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy everything at once
COPY . .

# Install with all build scripts allowed (safe in isolated Docker build)
RUN pnpm install --dangerously-allow-all-builds

# Build only network-hierarchy (api-server doesn't have a build step)
RUN cd packages/network-hierarchy && pnpm build

# Set working directory
WORKDIR /app/artifacts/api-server

# Expose port
EXPOSE 3000

# Start server
CMD ["pnpm", "start"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
