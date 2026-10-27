#!/usr/bin/env bash
# Restaura un backup de PostgreSQL. DESTRUCTIVO: reemplaza los datos actuales.
#
#   Uso: scripts/restore.sh /var/backups/taskflow/taskflow-20260101T031500Z-scheduled.dump
#
# Antes de restaurar se hace un backup de seguridad del estado actual.
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/app}"
COMPOSE=(docker compose -f docker-compose.prod.yml)
file="$(realpath "${1:?uso: restore.sh <fichero.dump>}")"

cd "$APP_DIR"
env_get() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- || true; }
DB_NAME="$(env_get POSTGRES_DB)"; DB_NAME="${DB_NAME:-taskflow}"
DB_USER="$(env_get POSTGRES_USER)"; DB_USER="${DB_USER:-taskflow}"

[[ -f "$file" ]] || { echo "No existe $file" >&2; exit 1; }
if [[ -f "$file.sha256" ]]; then
  (cd "$(dirname "$file")" && sha256sum -c "$(basename "$file").sha256")
fi

read -r -p "Esto SOBRESCRIBE la base de datos '$DB_NAME'. Escribe 'restaurar' para continuar: " answer
[[ "$answer" == "restaurar" ]] || { echo "Cancelado"; exit 1; }

bash "$APP_DIR/scripts/backup.sh" pre-restore

echo "Deteniendo el backend para evitar escrituras durante la restauración..."
"${COMPOSE[@]}" stop backend
trap '"${COMPOSE[@]}" start backend' EXIT

"${COMPOSE[@]}" exec -T db pg_restore -U "$DB_USER" -d "$DB_NAME" \
  --clean --if-exists --no-owner --single-transaction <"$file"

echo "Restauración completada; arrancando el backend."
