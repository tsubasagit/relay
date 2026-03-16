FROM node:22-slim AS builder

WORKDIR /app

# Copy root package files and tsconfig
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/api/package.json packages/api/
COPY packages/sdk/package.json packages/sdk/

# Install dependencies
RUN npm install --workspace=packages/api --workspace=packages/sdk

# Copy source
COPY packages/api/ packages/api/
COPY packages/sdk/ packages/sdk/

# Build
RUN npm run build --workspace=packages/api

# ─── Production ───
FROM node:22-slim

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/api/package.json packages/api/
COPY --from=builder /app/packages/sdk/package.json packages/sdk/
COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/packages/api/dist/ packages/api/dist/
COPY --from=builder /app/packages/api/node_modules/ packages/api/node_modules/ 2>/dev/null || true

ENV NODE_ENV=production
ENV API_PORT=8080

EXPOSE 8080

CMD ["node", "packages/api/dist/index.js"]
