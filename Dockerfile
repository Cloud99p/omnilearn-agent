FROM node:24-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy everything at once
COPY . .

# Configure pnpm to allow builds, then install
RUN pnpm config set allow-build "esbuild sharp @sentry-internal/node-cpu-profiler protobufjs @clerk/shared" && \
    pnpm config set ignore-workspace-root-check true && \
    pnpm install

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
