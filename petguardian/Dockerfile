# ---------- Stage 1: install all deps (incl. dev) for building ----------
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci
COPY . .
# Build the API (tsc -> server/dist) and the client (vite -> client/dist)
RUN npm run build --workspace server \
 && npm run build --workspace client

# ---------- Stage 2: production-only dependencies ----------
FROM node:22-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci --omit=dev

# ---------- Stage 3: lean runtime image ----------
FROM node:22-slim AS runtime
ENV NODE_ENV=production
ENV CLIENT_DIST=/app/client/dist
WORKDIR /app/server

# Hoisted production node_modules live at /app/node_modules
COPY --from=prod-deps /app/node_modules /app/node_modules
# Compiled API + SQL migrations + workspace manifest (marks this dir as ESM)
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/migrations ./migrations
COPY --from=build /app/server/package.json ./package.json
# Built client, served by the API in production
COPY --from=build /app/client/dist /app/client/dist

EXPOSE 4000
# index.js applies migrations on boot, then starts the HTTP server.
CMD ["node", "dist/index.js"]
