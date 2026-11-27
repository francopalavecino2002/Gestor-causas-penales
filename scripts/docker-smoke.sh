#!/usr/bin/env bash
# Smoke test of the production image (T65, ADR-0046), run by CI. It builds backend/Dockerfile, starts
# it with the `prod` profile next to a throwaway Postgres on a private network, and checks the health
# probes, the served frontend, the protected API and that `prod` refuses the demo profile.
# Nothing is pushed or deployed. Locally: bash scripts/docker-smoke.sh (needs Docker, ~5 minutes).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE="gestor-causas:smoke"
NETWORK="gestor-smoke"
DB_CONTAINER="gestor-smoke-db"
APP_CONTAINER="gestor-smoke-app"
PORT=18081
# Throwaway values for this test only.
DB_PASSWORD="smoke-only-password"
TOTP_KEY="c21va2UtdGVzdC1vbmx5LXRvdHAta2V5LTMyYnl0ZXM="

info() { printf '\033[36m==>\033[0m %s\n' "$*"; }
fail() {
  printf '\033[31mDocker smoke test failed:\033[0m %s\n' "$*" >&2
  docker logs "$APP_CONTAINER" 2>&1 | tail -n 80 >&2 || true
  exit 1
}

cleanup() {
  docker rm -f "$APP_CONTAINER" "$DB_CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

info "Building the image"
docker build -f backend/Dockerfile -t "$IMAGE" .

info "Starting Postgres"
docker network create "$NETWORK" >/dev/null
docker run -d --name "$DB_CONTAINER" --network "$NETWORK" \
  -e POSTGRES_DB=gestor -e POSTGRES_USER=gestor -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  postgres:18-alpine >/dev/null
# Over TCP: the image's temporary init server answers on the Unix socket only, then restarts.
db_ready=false
for _ in $(seq 1 30); do
  if docker exec "$DB_CONTAINER" pg_isready -h 127.0.0.1 -U gestor -d gestor >/dev/null 2>&1; then
    db_ready=true; break
  fi
  sleep 2
done
$db_ready || fail "Postgres never accepted TCP connections."

info "prod together with demo must refuse to start"
mkdir -p "$ROOT/.demo-logs"
REFUSED_LOG="$ROOT/.demo-logs/docker-smoke-refused.log"
if timeout 180 docker run --rm --network "$NETWORK" \
  -e SPRING_PROFILES_ACTIVE=prod,demo -e DEMO_PASSWORD=smoke-demo-password \
  -e DB_URL="jdbc:postgresql://$DB_CONTAINER:5432/gestor" \
  -e DB_USERNAME=gestor -e DB_PASSWORD="$DB_PASSWORD" -e TOTP_ENCRYPTION_KEY="$TOTP_KEY" \
  "$IMAGE" >"$REFUSED_LOG" 2>&1; then
  fail "the image started with SPRING_PROFILES_ACTIVE=prod,demo."
fi
grep -q "Unsafe production configuration" "$REFUSED_LOG" \
  || fail "the refusal did not come from ProductionSafetyCheck: $(tail -n 20 "$REFUSED_LOG")"

# 512 MB like the smallest recommended instance (docs/HOSTING.md): an OOM kill fails the test.
info "Starting the app with the prod profile, limited to 512 MB"
docker run -d --name "$APP_CONTAINER" --network "$NETWORK" -p "127.0.0.1:$PORT:8081" --memory 512m \
  -e DB_URL="jdbc:postgresql://$DB_CONTAINER:5432/gestor" \
  -e DB_USERNAME=gestor -e DB_PASSWORD="$DB_PASSWORD" -e TOTP_ENCRYPTION_KEY="$TOTP_KEY" \
  -e PORT=8081 \
  "$IMAGE" >/dev/null

BASE="http://localhost:$PORT"
ready=false
for _ in $(seq 1 60); do
  if curl -fsS "$BASE/actuator/health/readiness" >/dev/null 2>&1; then ready=true; break; fi
  sleep 2
done
$ready || fail "readiness never answered UP."

# Responses are read into variables first: `curl | grep -q` can fail under pipefail.
status() { curl -s -o /dev/null -w '%{http_code}' "$1"; }
body() { curl -fsS "$1"; }
headers() { curl -fsS -D - -o /dev/null "$1"; }

info "Health probes"
[[ "$(body "$BASE/actuator/health/liveness")" == *'"UP"'* ]] || fail "liveness is not UP."
[[ "$(body "$BASE/actuator/health/readiness")" == *'"UP"'* ]] || fail "readiness is not UP."

info "Frontend served by the backend"
shell="$(body "$BASE/")"
[[ "$shell" == *'<div id="root">'* ]] || fail "/ is not the SPA shell."
[[ "$(body "$BASE/causas")" == *'<div id="root">'* ]] || fail "a client route is not the SPA shell."
[[ "$shell" =~ (/assets/[^\"]+\.js) ]] || fail "index.html references no bundle."
asset="${BASH_REMATCH[1]}"
[[ "$(headers "$BASE$asset" | tr '[:upper:]' '[:lower:]')" == *'immutable'* ]] \
  || fail "$asset is not served with a long cache."
[ "$(status "$BASE/assets/missing-0000.js")" = "404" ] || fail "a missing asset did not answer 404."

info "API protected, cookies Secure, no demo data"
[ "$(status "$BASE/api/v1/cases")" = "401" ] || fail "the API answered without a session."
csrf_headers="$(headers "$BASE/api/v1/auth/csrf")"
[[ "$csrf_headers" == *'XSRF-TOKEN='*'Secure'* ]] || fail "the CSRF cookie is not Secure."
users="$(docker exec "$DB_CONTAINER" psql -U gestor -d gestor -tA -c 'SELECT count(*) FROM app_user')"
[ "$users" = "0" ] || fail "the prod profile created $users users (demo seeding?)."

[ "$(docker inspect -f '{{.State.OOMKilled}}' "$APP_CONTAINER")" = "false" ] || fail "the app was OOM-killed at 512 MB."
info "Memory after the checks: $(docker stats --no-stream --format '{{.MemUsage}}' "$APP_CONTAINER")"

info "Docker smoke test passed"
