# ──────────────────────────────────────────────────────────────
# Home Assistant Addon — Production Dockerfile
# Builds frontend + backend in a single container
# ──────────────────────────────────────────────────────────────

# Stage 1: Build React frontend
FROM node:24-alpine AS frontend-build
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Compile TypeScript backend
FROM node:24-alpine AS backend-build
WORKDIR /build
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npm run build

# Stage 3: Lean production runtime
FROM node:24-alpine
LABEL \
  io.hass.name="GIPS Calcio" \
  io.hass.description="Gestionale squadra calcio: calendario, giocatori, convocazioni e comunicazioni" \
  io.hass.arch="aarch64|amd64" \
  io.hass.type="addon" \
  io.hass.version="0.5.0"

WORKDIR /app

# Install only production dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled backend and built frontend
COPY --from=backend-build /build/dist ./dist
COPY --from=backend-build /build/package.json ./package.json
COPY --from=frontend-build /build/dist ./public

ENV NODE_ENV=production \
    PORT=8101 \
    FRONTEND_DIR=/app/public

EXPOSE 8101

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://localhost:8101/api/health || exit 1

CMD ["node", "dist/index.js"]
