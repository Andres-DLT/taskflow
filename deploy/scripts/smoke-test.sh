#!/usr/bin/env bash
# Smoke tests post-despliegue. Solo lectura: seguros contra producción.
#
#   Uso: smoke-test.sh <base_url> [commit_esperado]
#   Ej.: smoke-test.sh https://app.example.com 3f2a9c1...
set -Eeuo pipefail

BASE_URL="${1:?uso: smoke-test.sh <base_url> [commit_esperado]}"
EXPECTED_COMMIT="${2:-}"
ATTEMPTS="${SMOKE_ATTEMPTS:-30}"
DELAY="${SMOKE_DELAY:-5}"

fail() {
  echo "✗ $*" >&2
  exit 1
}
http_status() { curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL$1" 2>/dev/null || true; }
check() {
  local path=$1 want=${2:-200} got
  got="$(http_status "$path")"
  [[ "$got" == "$want" ]] || fail "$path -> $got (esperado $want)"
  echo "✓ $path -> $got"
}

echo "Esperando a que $BASE_URL esté listo..."
for ((i = 1; i <= ATTEMPTS; i++)); do
  [[ "$(http_status /readyz)" == 200 ]] && break
  ((i == ATTEMPTS)) && fail "/readyz no respondió 200 tras $ATTEMPTS intentos"
  sleep "$DELAY"
done

check /healthz
check /readyz
check /api/tasks
check /
check /api/no-existe 404

if [[ -n "$EXPECTED_COMMIT" ]]; then
  # Varias peticiones para pasar por todas las réplicas (round robin).
  for _ in 1 2 3 4; do
    commit="$(curl -fsS --max-time 10 "$BASE_URL/api/version" | sed -n 's/.*"commit":"\([^"]*\)".*/\1/p')"
    [[ "$commit" == "$EXPECTED_COMMIT" ]] || fail "versión servida '$commit' distinta de la esperada '$EXPECTED_COMMIT'"
  done
  echo "✓ /api/version -> $EXPECTED_COMMIT"
fi

echo "Smoke tests OK"
