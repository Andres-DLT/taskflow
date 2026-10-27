# syntax=docker/dockerfile:1.7

# ---- base: misma imagen fijada para todas las etapas ----------------------------
FROM node:24.22.1-alpine3.24 AS base
WORKDIR /app
ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false

# ---- deps: solo dependencias de producción, cacheadas por el lockfile ------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts

# ---- runtime: imagen final mínima, sin npm ni herramientas de build -------------
FROM base AS runtime
ARG APP_VERSION=dev
ARG GIT_SHA=local
ARG BUILD_DATE
LABEL org.opencontainers.image.title="taskflow-backend" \
      org.opencontainers.image.description="API REST de TaskFlow" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.licenses="MIT"

# tini como PID 1: reenvía señales (graceful shutdown) y recoge procesos zombis.
# Se elimina npm/corepack: no se necesitan en runtime y reducen superficie de ataque y CVEs.
RUN apk add --no-cache tini \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# Los ficheros quedan en propiedad de root y solo lectura para el usuario de la app.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY migrations ./migrations

ENV APP_VERSION=${APP_VERSION} \
    GIT_SHA=${GIT_SHA} \
    PORT=3000

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
