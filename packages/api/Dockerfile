FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/api/package.json packages/api/
RUN npm install --workspace=packages/api

COPY packages/api/ packages/api/
RUN npm run build --workspace=packages/api

EXPOSE 3456
CMD ["node", "packages/api/dist/index.js"]
