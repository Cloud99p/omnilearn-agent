FROM node:24-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy everything at once
COPY . .

# Install with explicit config flags for build scripts
RUN pnpm install --config.enable-pre-post-scripts=true --config.onlyBuiltDependencies="['@clerk/shared','@sentry-internal/node-cpu-profiler','esbuild','protobufjs','sharp','@swc/core','msw','unrs-resolver']"

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
