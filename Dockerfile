FROM node:24-slim

# Cache bust: 2026-06-12 route fix
# Pin pnpm to the major that wrote pnpm-lock.yaml (lockfileVersion 9.0 -> pnpm 9).
# Unpinned `npm install -g pnpm` pulls pnpm 10, which refuses to run because
# package.json still carries a `pnpm.overrides` field it no longer reads
# (ERR_PNPM_VERIFY_DEPS_BEFORE_RUN). Pinning restores the build without
# re-resolving a single dependency: same lockfile, same tree, same overrides.
RUN npm install -g pnpm@9

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

# Set working directory
WORKDIR /app/artifacts/api-server

# Expose port
EXPOSE 3000

# Start server (tsx handles TypeScript at runtime)
CMD ["pnpm", "start"]

# Health check — note: Railway overrides with railway.toml healthcheck.
# This is a fallback only; use PORT-aware check (default 3000 when unset).
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=10 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/api/healthz || exit 1
