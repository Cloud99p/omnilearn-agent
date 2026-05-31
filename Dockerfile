FROM node:24-slim

# Install pnpm
RUN npm install -g pnpm

# Install Python/pip for markitdown
RUN apt-get update && apt-get install -y python3 python3-pip --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy everything at once
COPY . .

# Install with all build scripts allowed (safe in isolated Docker build)
RUN pnpm install --dangerously-allow-all-builds

# Install markitdown for better PDF/DOCX extraction (with PDF plugin)
RUN pip3 install --break-system-packages "markitdown[pdf]"

# Build workspace packages first (lib/db needs to be built for proper exports)
RUN pnpm --filter @workspace/db build

# Build network-hierarchy
RUN cd packages/network-hierarchy && pnpm build

# Build api-server (compile TypeScript to JavaScript)
WORKDIR /app/artifacts/api-server
RUN pnpm build

# Expose port
EXPOSE 3000

# Start server (use compiled JavaScript, not tsx)
CMD ["pnpm", "start"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
