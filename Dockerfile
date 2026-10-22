# ==============================================================
# AI Agent Command Center — Production Multi-Stage Dockerfile
# Autonomous Multi-Agent Swarm OS & 3D Spatial Command Bridge
# ==============================================================

# --------------------------------------------------------------
# Stage 1: Build Frontend (Vite/Three.js) & Backend (Express ESM)
# --------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Copy package manifests across monorepo workspaces
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Clean install all dependencies (including devDependencies for build tools)
RUN npm ci

# Copy full source trees
COPY . .

# Run full monorepo build (compiles server/dist and client/dist)
RUN npm run build

# --------------------------------------------------------------
# Stage 2: Hardened Production Runtime
# --------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install runtime utilities for health checks and process telemetry
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests & install only production dependencies
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled artifacts from builder stage
COPY --from=builder /app/bin ./bin
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/README.md ./README.md

# Setup sandbox workspace directory with appropriate permissions
RUN mkdir -p /app/sandbox /app/docs/swarm-reports && chown -R node:node /app

# Run as unprivileged user for security hardening
USER node

# Expose default HTTP port
EXPOSE 3000

# Healthcheck validating server and database readiness
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT:-3000}/healthz || exit 1

# Launch the foreground server process (supervised by Railway container runtime)
CMD ["node", "bin/ai-center.js", "run-server"]
