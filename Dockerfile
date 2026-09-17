FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
COPY server ./server
RUN npm test && npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 SOUNDBRIDGE_DATABASE=/app/.data/soundbridge.sqlite
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/domain.js ./src/domain.js
COPY src/ai/agents.js ./src/ai/agents.js
RUN mkdir -p /app/.data && chown node:node /app/.data
USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node server/healthcheck.js
CMD ["node", "server/start.js"]
