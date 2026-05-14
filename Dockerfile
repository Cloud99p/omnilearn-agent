# Dockerfile for OmniLearn API Server
# Multi-stage build for proper native module support (sharp, ONNX Runtime)

FROM node:22-bookworm AS builder

RUN apt-get update && apt-get install -y \
    poppler-utils pandoc tesseract-ocr tesseract-ocr-eng \
    gnumeric libvips-dev python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN vips --version

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/integrations-anthropic-ai/package.json ./lib/integrations-anthropic-ai/

RUN pnpm install

COPY artifacts/api-server ./artifacts/api-server
COPY lib/db ./lib/db
COPY lib/api-zod ./lib/api-zod
COPY lib/integrations-anthropic-ai ./lib/integrations-anthropic-ai

RUN pnpm --filter @workspace/api-server run build

FROM node:22-bookworm

RUN apt-get update && apt-get install -y \
    poppler-utils pandoc tesseract-ocr tesseract-ocr-eng \
    gnumeric libvips42 python3 \
    && rm -rf /var/lib/apt/lists/* && apt-get clean

RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/artifacts/api-server ./artifacts/api-server
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/package.json ./

EXPOSE 3000
ENV NODE_ENV=production PORT=3000
CMD ["pnpm", "--filter", "@workspace/api-server", "run", "start"]
# Rebuild: Thu May 14 23:46:11 UTC 2026
