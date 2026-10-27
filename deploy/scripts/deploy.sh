#!/usr/bin/env bash
# Despliegue blue/green sin downtime de TaskFlow sobre Docker Compose.
#
#   Uso: scripts/deploy.sh <image-tag>        (lo invoca el pipeline de CD por SSH)
#
# Flujo: validar → pull → infra base → backup → migraciones → rollout backend → rollout frontend
#        → persistir versión. Si algo falla después de cambiar de versión, se restaura la anterior.
#
# Variables opcionales: SKIP_BACKUP=1, SKIP_MIGRATIONS=1 (las usa rollback.sh), HEALTH_TIMEOUT=120.
set -Eeuo pipefail

TAG="${1:?uso: deploy.sh <image-tag>}"
APP_DIR="${APP_DIR:-/opt/app}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
HISTORY_FILE=".deploy-history"
COMPOSE=(docker compose -f docker-compose.prod.yml)

cd "$APP_DIR"

log() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }
env_get() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- || true; }
env_set() {
  if grep -qE "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else printf '%s=%s\n' "$1" "$2" >>.env; fi
}

# --- Validaciones previas -----------------------------------------------------------------
[[ "$TAG" =~ ^[A-Za-z0-9_.-]+$ ]] || die "tag inválido: $TAG"
[[ -f .env ]] || die "falta $APP_DIR/.env (copia .env.example y rellénalo)"
for secret in db_password grafana_admin_password alert_webhook_url; do
  [[ -s "secrets/$secret" ]] || die "falta secrets/$secret (ejecuta scripts/init-secrets.sh)"
done

# Un único despliegue simultáneo por host (la restauración automática hereda el lock).
if [[ -z "${DEPLOY_LOCK_HELD:-}" ]]; then
  exec 9>/tmp/taskflow-deploy.lock
  flock -n 9 || die "hay otro despliegue en curso"
  export DEPLOY_LOCK_HELD=1
fi

PREVIOUS_TAG="$(env_get IMAGE_TAG)"
DOMAIN="$(env_get DOMAIN)"
export IMAGE_TAG="$TAG" # El entorno tiene prioridad sobre .env; .env solo se actualiza al terminar bien.

# --- Restauración automática si fallamos con la versión ya cambiada ------------------------
SWITCHED=0
on_error() {
  local code=$?
  trap - ERR
  if ((SWITCHED)) && [[ -n "$PREVIOUS_TAG" && "$PREVIOUS_TAG" != "$TAG" && -z "${IN_RESTORE:-}" ]]; then
    log "fallo tras cambiar de versión: restaurando $PREVIOUS_TAG"
    IN_RESTORE=1 SKIP_BACKUP=1 SKIP_MIGRATIONS=1 bash "$0" "$PREVIOUS_TAG" ||
      log "¡LA RESTAURACIÓN AUTOMÁTICA HA FALLADO! Se requiere intervención manual (docs/RUNBOOK.md)"
  fi
  exit "$code"
}
trap on_error ERR

# Espera a que todos los contenedores indicados estén healthy.
wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) id status pending
  while ((SECONDS < deadline)); do
    pending=0
    for id in "$@"; do
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id")"
      case "$status" in
        healthy) ;;
        unhealthy | exited | dead)
          log "contenedor ${id:0:12} en estado $status"
          return 1
          ;;
        *) pending=1 ;;
      esac
    done
    ((pending == 0)) && return 0
    sleep 2
  done
  log "timeout ($HEALTH_TIMEOUT s) esperando el healthcheck"
  return 1
}

# Blue/green por servicio: duplica réplicas con la imagen nueva, espera a que estén sanas,
# y solo entonces retira las antiguas. Caddy descubre las réplicas por DNS (dynamic a).
rollout() {
  local svc=$1 old all new count
  old="$("${COMPOSE[@]}" ps -q "$svc" | sort)"

  if [[ -z "$old" ]]; then
    log "$svc: primer arranque"
    "${COMPOSE[@]}" up -d --no-deps --wait --wait-timeout "$HEALTH_TIMEOUT" "$svc"
    return
  fi

  count="$(wc -l <<<"$old")"
  log "$svc: arrancando $count réplica(s) nuevas junto a las actuales"
  "${COMPOSE[@]}" up -d --no-deps --no-recreate --scale "$svc=$((count * 2))" "$svc"

  all="$("${COMPOSE[@]}" ps -q "$svc" | sort)"
  new="$(comm -13 <(echo "$old") <(echo "$all"))"
  if [[ -z "$new" ]]; then
    log "$svc: no se crearon réplicas nuevas"
    return 1
  fi

  # shellcheck disable=SC2086 # se quiere word splitting: una lista de IDs
  if ! wait_healthy $new; then
    for id in $new; do docker logs --tail 30 "$id" 2>&1 | sed "s/^/  [${id:0:12}] /"; done
    docker rm -f $new >/dev/null
    log "$svc: versión nueva no sana; se retiran sus réplicas y se mantiene la anterior"
    return 1
  fi

  log "$svc: réplicas nuevas sanas; drenando las antiguas"
  sleep 5 # > intervalo de refresco DNS de Caddy (2s)
  # shellcheck disable=SC2086
  docker stop --time 30 $old >/dev/null
  # shellcheck disable=SC2086
  docker rm $old >/dev/null
}

# --- 1. Imágenes -------------------------------------------------------------------------------
log "desplegando $TAG (anterior: ${PREVIOUS_TAG:-ninguna})"
"${COMPOSE[@]}" pull --quiet backend frontend

# --- 2. Infraestructura base y configuración ----------------------------------------------------
printf '[{"targets":["https://%s/healthz"]}]\n' "$DOMAIN" >monitoring/prometheus/targets/blackbox.json
"${COMPOSE[@]}" up -d --no-deps --wait db
"${COMPOSE[@]}" up -d --no-deps proxy
"${COMPOSE[@]}" exec -T proxy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 ||
  log "aviso: no se pudo recargar Caddy (normal en el primer arranque)"

if [[ ",$(env_get COMPOSE_PROFILES)," == *",monitoring,"* ]]; then
  "${COMPOSE[@]}" up -d --no-deps prometheus alertmanager blackbox node-exporter cadvisor grafana
  "${COMPOSE[@]}" kill -s SIGHUP prometheus alertmanager >/dev/null 2>&1 || true # recarga de config
fi

# --- 3. Backup previo a migraciones -------------------------------------------------------------
if [[ -z "${SKIP_BACKUP:-}" && -n "$PREVIOUS_TAG" ]]; then
  log "backup previo al despliegue"
  bash "$APP_DIR/scripts/backup.sh" "pre-deploy-$TAG"
fi

# --- 4. Migraciones (forward-only y compatibles con la versión anterior: expand/contract) ------
if [[ -z "${SKIP_MIGRATIONS:-}" ]]; then
  log "aplicando migraciones"
  "${COMPOSE[@]}" --profile tools run --rm migrate
fi

# --- 5. Rollout ----------------------------------------------------------------------------------
rollout backend
SWITCHED=1
rollout frontend

# --- 6. Persistir estado ------------------------------------------------------------------------
env_set IMAGE_TAG "$TAG"
printf '%s %s\n' "$(date -u +%FT%TZ)" "$TAG" >>"$HISTORY_FILE"
docker image prune -af --filter "until=168h" >/dev/null 2>&1 || true

log "despliegue de $TAG completado"
