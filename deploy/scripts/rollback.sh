#!/usr/bin/env bash
# Vuelve a la versión desplegada anteriormente, o a la indicada.
#
#   Uso: scripts/rollback.sh [image-tag]
#
# No revierte migraciones: son forward-only y compatibles hacia atrás (patrón expand/contract),
# así que la versión anterior funciona con el esquema nuevo. Para revertir datos: restore.sh.
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/app}"
cd "$APP_DIR"

current="$(grep -E '^IMAGE_TAG=' .env | tail -n1 | cut -d= -f2- || true)"
target="${1:-}"

if [[ -z "$target" ]]; then
  # Último tag desplegado con éxito que no sea el actual.
  target="$(awk -v cur="$current" '$2 != cur { t = $2 } END { print t }' .deploy-history 2>/dev/null || true)"
fi
[[ -n "$target" ]] || { echo "No hay una versión anterior a la que volver" >&2; exit 1; }

echo "Rollback: ${current:-?} -> $target"
SKIP_BACKUP=1 SKIP_MIGRATIONS=1 exec bash "$APP_DIR/scripts/deploy.sh" "$target"
