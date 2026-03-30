# Terminal Care - Dockerfile
# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Debug: List files to ensure src exists
RUN ls -la && ls -la src/

# Build frontend
RUN npm run build

# Production stage
FROM node:20-slim AS production

WORKDIR /app

# Install production dependencies and tsx for running TypeScript
COPY package.json package-lock.json ./
RUN npm ci --production && npm install tsx && npm cache clean --force

# Copy built frontend and server files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

# Copy Imported_Preset.json for auto-import feature (serve via API and static)
COPY --from=builder /app/Imported_Preset.json ./Imported_Preset.json
COPY --from=builder /app/Imported_Preset.json ./dist/Imported_Preset.json

# Create data and uploads directories (they are not in builder due to .gitignore)
RUN mkdir -p data public/uploads

# Expose port
EXPOSE 3001

# Environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start server using tsx (since server uses TypeScript)
CMD ["npx", "tsx", "server/index.ts"]
