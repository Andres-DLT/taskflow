# syntax=docker/dockerfile:1.7

# ---- build: compila la SPA con Vite ----------------------------------------------
FROM node:26.12.1-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts
COPY . .
RUN npm run build

# ---- runtime: nginx sin privilegios (uid 101, puerto 8080) sirviendo estáticos ----
FROM nginxinc/nginx-unprivileged:1.30-alpine AS runtime
ARG APP_VERSION=dev
ARG GIT_SHA=local
ARG BUILD_DATE
LABEL org.opencontainers.image.title="taskflow-frontend" \
      org.opencontainers.image.description="SPA de TaskFlow servida por nginx" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.licenses="MIT"

# Parches de seguridad de Alpine publicados después de la imagen base, y fuera curl (no se usa:
# el healthcheck usa el wget de busybox). Se vuelve al usuario sin privilegios de la imagen.
USER root
RUN apk upgrade --no-cache && apk del --no-cache curl
USER 101

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/healthz"]
