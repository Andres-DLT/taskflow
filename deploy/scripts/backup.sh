#!/usr/bin/env bash
# Backup lógico de PostgreSQL (pg_dump formato custom), verificado, con retención local
# y copia opcional a S3 usando el rol IAM de la instancia (sin claves en el servidor).
#
#   Uso: scripts/backup.sh [etiqueta]
#   Cron (lo instala cloud-init): 15 3 * * * /opt/app/scripts/backup.sh scheduled
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/app}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/taskflow}"
LABEL="${1:-manual}"
COMPOSE=(docker compose -f docker-compose.prod.yml)

cd "$APP_DIR"
env_get() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2- || true; }

DB_NAME="$(env_get POSTGRES_DB)"; DB_NAME="${DB_NAME:-taskflow}"
DB_USER="$(env_get POSTGRES_USER)"; DB_USER="${DB_USER:-taskflow}"
RETENTION_DAYS="$(env_get BACKUP_RETENTION_DAYS)"; RETENTION_DAYS="${RETENTION_DAYS:-14}"
S3_BUCKET="$(env_get BACKUP_S3_BUCKET)"
AWS_REGION="$(env_get AWS_REGION)"

umask 077
mkdir -p "$BACKUP_DIR"
file="$BACKUP_DIR/${DB_NAME}-$(date -u +%Y%m%dT%H%M%SZ)-${LABEL}.dump"
trap 'rm -f "$file.partial"' EXIT

echo "Backup -> $file"
"${COMPOSE[@]}" exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom --no-owner >"$file.partial"
mv "$file.partial" "$file"

# Un backup que no se puede leer no es un backup.
"${COMPOSE[@]}" exec -T db pg_restore --list <"$file" >/dev/null
(cd "$BACKUP_DIR" && sha256sum "$(basename "$file")" >"$(basename "$file").sha256")

if [[ -n "$S3_BUCKET" ]]; then
  echo "Subiendo a s3://$S3_BUCKET/postgres/"
  for f in "$file" "$file.sha256"; do
    docker run --rm -e AWS_REGION="$AWS_REGION" -v "$BACKUP_DIR:/backups:ro" amazon/aws-cli:2.38.6 \
      s3 cp "/backups/$(basename "$f")" "s3://$S3_BUCKET/postgres/" --only-show-errors
  done
fi

find "$BACKUP_DIR" -type f \( -name '*.dump' -o -name '*.dump.sha256' \) -mtime "+$RETENTION_DAYS" -delete
echo "Backup OK ($(du -h "$file" | cut -f1))"
