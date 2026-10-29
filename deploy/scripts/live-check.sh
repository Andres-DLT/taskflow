#!/usr/bin/env bash
# Prueba en vivo de extremo a extremo contra una instancia pública:
# crea una tarea, comprueba que se guardó, la deja visible unos segundos y la borra.
# A diferencia de smoke-test.sh, escribe datos (y los limpia al terminar).
#
#   Uso: live-check.sh <base_url> [segundos_visible]
#   Ej.: live-check.sh https://demo.example.com 15
#
# Si existe $GITHUB_STEP_SUMMARY, escribe allí un resumen en Markdown.
set -Eeuo pipefail

BASE_URL="${1:?uso: live-check.sh <base_url> [segundos_visible]}"
BASE_URL="${BASE_URL%/}"
VISIBLE_SECONDS="${2:-15}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
TITLE="Prueba en vivo desde GitHub Actions · $(date -u +%H:%M:%S) UTC"
TASK_ID=""
ROWS=()

cleanup() {
  [[ -n "$TASK_ID" ]] && curl -sS -o /dev/null --max-time 10 -X DELETE "$BASE_URL/api/tasks/$TASK_ID" || true
}
trap cleanup EXIT

write_summary() {
  local result=$1
  {
    echo "## Prueba en vivo: $result"
    echo
    echo "Instancia: <$BASE_URL>"
    echo
    echo "| Paso | Resultado | Tiempo |"
    echo "|---|---|---|"
    printf '%s\n' "${ROWS[@]}"
  } >> "$SUMMARY"
}

fail() {
  echo "✗ $*" >&2
  ROWS+=("| $* | ❌ | |")
  write_summary "❌ fallida"
  exit 1
}

pass() {
  local step=$1 ms=$2
  echo "✓ $step (${ms} ms)"
  ROWS+=("| $step | ✅ | ${ms} ms |")
}

# Ejecuta curl y deja el cuerpo en $BODY, el código en $CODE y la duración en $MS.
request() {
  local out
  out="$(curl -sS --max-time 15 -w '\n%{http_code} %{time_total}' "$@" 2>&1)" || fail "sin respuesta de $BASE_URL"
  BODY="$(sed '$d' <<< "$out")"
  read -r CODE seconds <<< "$(tail -n1 <<< "$out")"
  MS="$(awk -v s="$seconds" 'BEGIN { printf "%d", s * 1000 }')"
}

request "$BASE_URL/readyz"
[[ "$CODE" == 200 ]] || fail "API y base de datos disponibles (/readyz -> $CODE)"
pass "API y base de datos disponibles" "$MS"

request "$BASE_URL/api/version"
[[ "$CODE" == 200 ]] || fail "Versión desplegada (/api/version -> $CODE)"
commit="$(jq -r '.commit // "?"' <<< "$BODY" | cut -c1-7)"
pass "Versión desplegada: $(jq -r '.version // "?"' <<< "$BODY") · commit $commit" "$MS"

request -X POST -H 'Content-Type: application/json' \
  --data "$(jq -cn --arg t "$TITLE" '{title: $t}')" "$BASE_URL/api/tasks"
[[ "$CODE" == 201 ]] || fail "Crear tarea (POST /api/tasks -> $CODE)"
TASK_ID="$(jq -r '.id' <<< "$BODY")"
pass "Crear tarea #$TASK_ID (navegador → Caddy → API → PostgreSQL)" "$MS"

request "$BASE_URL/api/tasks"
jq -e --argjson id "$TASK_ID" 'any(.[]; .id == $id)' <<< "$BODY" > /dev/null \
  || fail "Leer la tarea de la base de datos"
pass "Leer la tarea de la base de datos" "$MS"

echo "La tarea queda visible ${VISIBLE_SECONDS}s en la app..."
sleep "$VISIBLE_SECONDS"

request -X DELETE "$BASE_URL/api/tasks/$TASK_ID"
[[ "$CODE" == 204 ]] || fail "Borrar la tarea de prueba (DELETE -> $CODE)"
TASK_ID=""
pass "Borrar la tarea de prueba" "$MS"

write_summary "✅ correcta"
echo "Prueba en vivo OK"
