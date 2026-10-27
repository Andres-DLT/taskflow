#!/usr/bin/env bash
# Prepara el servidor la primera vez: genera secretos aleatorios y el .env a partir del ejemplo.
# Idempotente: nunca sobrescribe un secreto existente.
#
#   Uso: ALERT_WEBHOOK_URL=https://hooks.slack.com/services/... scripts/init-secrets.sh
set -Eeuo pipefail

cd "${APP_DIR:-/opt/app}"

# El directorio es 700 (solo el usuario deploy en el host). Los ficheros son 644 porque Compose
# los monta tal cual dentro de contenedores que corren con otros UID (node=1000, grafana=472).
mkdir -p secrets
chmod 700 secrets

create_secret() {
  local name=$1 value=$2
  if [[ -s "secrets/$name" ]]; then
    echo "= secrets/$name ya existe, se conserva"
  else
    printf '%s' "$value" >"secrets/$name"
    echo "+ secrets/$name creado"
  fi
  chmod 644 "secrets/$name"
}

create_secret db_password "$(openssl rand -hex 24)"
create_secret grafana_admin_password "$(openssl rand -hex 16)"
create_secret alert_webhook_url "${ALERT_WEBHOOK_URL:-https://hooks.slack.com/services/CHANGE/ME/NOW}"

if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env
  echo "+ .env creado desde .env.example -> edita DOMAIN, ACME_EMAIL e IMAGE_NAMESPACE"
fi
