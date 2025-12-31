# Plex Collection Creator - Multi-stage Docker Build
# Uses Debian-slim for glibc compatibility with onnxruntime-node

# =============================================================================
# Stage 1: Dependencies
# =============================================================================
FROM node:20-slim AS deps

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# =============================================================================
# Stage 2: Builder
# =============================================================================
FROM node:20-slim AS builder

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Drizzle migrations (if schema changed)
RUN npm run db:generate || true

# Build the Next.js application
RUN npm run build

# =============================================================================
# Stage 3: Runner (Production)
# =============================================================================
FROM node:20-slim AS runner

WORKDIR /app

# Install runtime dependencies for health check
RUN apt-get update && apt-get install -y \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs nextjs

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Drizzle migrations for runtime migration
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

# Copy native modules (better-sqlite3 requires this)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prebuild-install ./node_modules/prebuild-install

# Copy embedding/ML modules for multi-pass analysis
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@xenova ./node_modules/@xenova
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/onnxruntime-node ./node_modules/onnxruntime-node
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/ml-kmeans ./node_modules/ml-kmeans
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/ml-distance-euclidean ./node_modules/ml-distance-euclidean
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/ml-matrix ./node_modules/ml-matrix
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/ml-nearest-vector ./node_modules/ml-nearest-vector
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/ml-random ./node_modules/ml-random
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/ml-xsadd ./node_modules/ml-xsadd
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/ml-array-max ./node_modules/ml-array-max
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/ml-array-min ./node_modules/ml-array-min
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/ml-array-rescale ./node_modules/ml-array-rescale
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/is-any-array ./node_modules/is-any-array

# Create cache directory for embedding model (will be downloaded on first use)
RUN mkdir -p /app/.cache && chown nextjs:nodejs /app/.cache

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set default environment variables
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL="/app/data/plex-collections.db"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the application
CMD ["node", "server.js"]
