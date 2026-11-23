#!/usr/bin/env bash
# End-to-end tests of the demo flow (T32): recreates the `gestor_e2e` database, starts the backend
# on :8081 with the `dev,demo` profiles (fictitious seed relative to today), runs the Playwright
# suite in frontend/e2e-demo against it and stops the backend. CI runs this same script.
#
#   bash scripts/e2e-demo.sh                  # the whole suite
#   bash scripts/e2e-demo.sh two-factor       # extra arguments go to `playwright test`
#
# Uses its own database, so neither the development one (`gestor_causas`) nor the demo one
# (`gestor_demo`) is touched. See docs/DEMO.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BACKEND_PORT=8081
E2E_DB=gestor_e2e
LOG_DIR="$ROOT/.demo-logs"

info() { printf '\033[36m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

require() {
  command -v "$1" >/dev/null 2>&1 || fail "missing '$1'. $2"
}

require docker "Install Docker (with Compose)."
require java "Install a JDK 21 or newer."
require npm "Install Node 22.12 or newer."
require curl "Install curl."
docker info >/dev/null 2>&1 || fail "Docker is not running."

status=0
# curl exits with 7 when nothing listens on the port. Windows retries a refused connection for
# about two seconds per address (::1, then 127.0.0.1), hence the generous timeout.
curl -s -o /dev/null --max-time 10 "http://localhost:$BACKEND_PORT" || status=$?
[ "$status" -eq 7 ] || fail "port $BACKEND_PORT is busy: stop the backend that is running there."

# The only-script Maven wrapper needs mktemp, missing in some Git Bash installs.
if command -v mktemp >/dev/null 2>&1; then
  MVN=(./mvnw)
else
  require mvn "This Git Bash has no mktemp: install Maven."
  MVN=(mvn)
fi

# A throwaway password: the database is new on every run, so nothing has to remember it.
if [ -z "${DEMO_PASSWORD:-}" ]; then
  DEMO_PASSWORD="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 20 || true)"
fi
[ "${#DEMO_PASSWORD}" -ge 12 ] || fail "DEMO_PASSWORD must have at least 12 characters."
export DEMO_PASSWORD

mkdir -p "$LOG_DIR"

BACKEND_PID=""
# shellcheck disable=SC2329 # invoked by the EXIT trap
cleanup() {
  [ -n "$BACKEND_PID" ] || return 0
  kill -0 "$BACKEND_PID" 2>/dev/null || return 0
  info "Stopping the backend"
  if [ -r "/proc/$BACKEND_PID/winpid" ]; then
    taskkill //T //F //PID "$(cat "/proc/$BACKEND_PID/winpid")" >/dev/null 2>&1 || true
  else
    pkill -TERM -P "$BACKEND_PID" 2>/dev/null || true
    kill -TERM "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

info "Starting PostgreSQL on localhost:5434"
docker compose up -d --wait postgres

info "Recreating the $E2E_DB database"
docker compose exec -T postgres sh -c "psql -v ON_ERROR_STOP=1 -q -U \"\$POSTGRES_USER\" -d postgres \
  -c 'DROP DATABASE IF EXISTS $E2E_DB WITH (FORCE)' -c 'CREATE DATABASE $E2E_DB'"

info "Starting the backend on :$BACKEND_PORT (profiles dev,demo; log in $LOG_DIR/e2e-backend.log)"
(
  cd backend
  export DB_URL="jdbc:postgresql://localhost:5434/$E2E_DB"
  export SPRING_PROFILES_ACTIVE=dev,demo
  exec "${MVN[@]}" -B -q spring-boot:run
) >"$LOG_DIR/e2e-backend.log" 2>&1 &
BACKEND_PID=$!

info "Waiting for the backend (the first build takes a few minutes)"
ready=false
for _ in $(seq 400); do
  kill -0 "$BACKEND_PID" 2>/dev/null || break
  if curl -s --max-time 2 "http://localhost:$BACKEND_PORT/actuator/health" 2>/dev/null | grep -q '"UP"'; then
    ready=true
    break
  fi
  sleep 1
done
if ! $ready; then
  tail -n 60 "$LOG_DIR/e2e-backend.log" >&2 || true
  fail "the backend did not start. See $LOG_DIR/e2e-backend.log"
fi

if [ ! -d frontend/node_modules ]; then
  info "Installing frontend dependencies (npm ci)"
  npm --prefix frontend ci
fi

info "Running the demo flow with Playwright"
npm --prefix frontend run test:e2e:demo -- "$@"
