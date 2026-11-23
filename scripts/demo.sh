#!/usr/bin/env bash
# One-command local demo (T31): Postgres + backend (profiles dev,demo) + frontend, then opens the
# browser and prints the fictitious demo users. Each run recreates the `gestor_demo` database so
# the demo dates start from today; the development database is not touched. Ctrl+C stops backend
# and frontend; Postgres keeps running (stop it with `docker compose down`).
#
#   bash scripts/demo.sh           # also serves the app on the LAN IP, for a phone on the Wi-Fi
#   bash scripts/demo.sh --local   # localhost only, with Secure cookies as in production
#
# Windows users can run scripts/demo.ps1 instead. See docs/DEMO.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BACKEND_PORT=8081
FRONTEND_PORT=5173
LOG_DIR="$ROOT/.demo-logs"
DEMO_DB=gestor_demo
LAN=true

usage() {
  cat <<'EOF'
Demo local en un comando (docs/DEMO.md).

  bash scripts/demo.sh           también publica la app en la IP de la red local (celular)
  bash scripts/demo.sh --local   solo en esta compu, con cookies Secure como en producción
EOF
}

for arg in "$@"; do
  case "$arg" in
    --local) LAN=false ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Opción desconocida: $arg (usá --local o --help)" >&2; exit 2 ;;
  esac
done

info() { printf '\033[36m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

require() {
  command -v "$1" >/dev/null 2>&1 || fail "falta '$1'. $2"
}

port_in_use() {
  # curl exits with 7 when nothing listens on the port.
  local status=0
  curl -s -o /dev/null --max-time 2 "http://localhost:$1" || status=$?
  [ "$status" -ne 7 ]
}

# Reads DEMO_PASSWORD from the environment or .env; otherwise generates one and saves it in .env,
# because the seeder creates the users once and later runs must reuse the same password.
demo_password() {
  if [ -n "${DEMO_PASSWORD:-}" ]; then
    printf '%s' "$DEMO_PASSWORD"
    return
  fi
  if [ -f .env ] && grep -Eq '^DEMO_PASSWORD=.+' .env; then
    # demo.ps1 may have written the line with CRLF.
    grep -E '^DEMO_PASSWORD=' .env | tail -n 1 | cut -d= -f2- | tr -d '\r'
    return
  fi
  local generated
  generated="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 20 || true)"
  [ -f .env ] || cp .env.example .env
  printf '\nDEMO_PASSWORD=%s\n' "$generated" >>.env
  printf '%s' "$generated"
}

# IPv4 of the interface that holds the default route (skips Docker/WSL virtual adapters).
lan_ip() {
  case "$(uname -s)" in
    Linux)
      ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}'
      ;;
    Darwin)
      ipconfig getifaddr "$(route -n get default 2>/dev/null | awk '/interface:/ {print $2}')" 2>/dev/null
      ;;
    MINGW* | MSYS* | CYGWIN*)
      powershell.exe -NoProfile -Command \
        "\$r = Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Sort-Object RouteMetric | Select-Object -First 1; (Get-NetIPAddress -InterfaceIndex \$r.ifIndex -AddressFamily IPv4).IPAddress" \
        2>/dev/null | tr -d '\r' | head -n 1
      ;;
  esac
}

open_browser() {
  case "$(uname -s)" in
    # Never fatal: the app is already up and the URL is printed below.
    Darwin) open "$1" || true ;;
    MINGW* | MSYS* | CYGWIN*) cmd.exe //c start "" "$1" >/dev/null 2>&1 || true ;;
    *) if command -v xdg-open >/dev/null 2>&1; then xdg-open "$1" >/dev/null 2>&1 || true; fi ;;
  esac
}

# Stops a background process and its children (mvn starts a separate java process).
# shellcheck disable=SC2329 # called from cleanup, which runs from the EXIT trap
stop_tree() {
  local pid="$1"
  kill -0 "$pid" 2>/dev/null || return 0
  if [ -r "/proc/$pid/winpid" ]; then
    taskkill //T //F //PID "$(cat "/proc/$pid/winpid")" >/dev/null 2>&1 || true
  else
    local child
    for child in $(pgrep -P "$pid" 2>/dev/null); do
      stop_tree "$child"
    done
    kill -TERM "$pid" 2>/dev/null || true
  fi
}

BACKEND_PID=""
FRONTEND_PID=""
# shellcheck disable=SC2329 # invoked by the EXIT trap
cleanup() {
  if [ -z "$BACKEND_PID$FRONTEND_PID" ]; then return; fi
  echo
  info "Deteniendo backend y frontend (Postgres sigue corriendo: docker compose down)"
  if [ -n "$FRONTEND_PID" ]; then stop_tree "$FRONTEND_PID"; fi
  if [ -n "$BACKEND_PID" ]; then stop_tree "$BACKEND_PID"; fi
}

wait_for() {
  local name="$1" url="$2" pid="$3" seconds="$4" body="${5:-}" response
  info "Esperando $name ($url)..."
  for _ in $(seq "$seconds"); do
    kill -0 "$pid" 2>/dev/null || fail "$name terminó con error. Mirá $LOG_DIR/$name.log"
    if response="$(curl -s --max-time 2 "$url" 2>/dev/null)" && [[ "$response" == *"$body"* ]]; then
      return 0
    fi
    sleep 1
  done
  fail "$name no respondió en $seconds s. Mirá $LOG_DIR/$name.log"
}

# --- Checks -------------------------------------------------------------------------------------
require docker "Instalá Docker Desktop (o Docker Engine con Compose)."
require node "Instalá Node 22.12 o superior."
require npm "Instalá Node 22.12 o superior."
require java "Instalá un JDK 21 o superior."
require curl "Instalá curl."
docker info >/dev/null 2>&1 || fail "Docker no está corriendo. Abrí Docker Desktop y probá de nuevo."
port_in_use "$BACKEND_PORT" && fail "el puerto $BACKEND_PORT está ocupado (¿quedó un backend corriendo?)."
port_in_use "$FRONTEND_PORT" && fail "el puerto $FRONTEND_PORT está ocupado (¿quedó un frontend corriendo?)."

# The only-script Maven wrapper needs mktemp, missing in some Git Bash installs.
if command -v mktemp >/dev/null 2>&1; then
  MVN=(./mvnw)
else
  require mvn "Tu Git Bash no tiene mktemp: instalá Maven o usá scripts/demo.ps1."
  MVN=(mvn)
fi

DEMO_PASSWORD="$(demo_password)"
[ "${#DEMO_PASSWORD}" -ge 12 ] || fail "DEMO_PASSWORD tiene que tener al menos 12 caracteres."
export DEMO_PASSWORD

if $LAN; then
  # Phones reach the app over plain HTTP on the LAN IP, where browsers drop Secure cookies.
  # Demo only, with fictitious data (ADR-0029); --local keeps them Secure.
  export SERVER_SERVLET_SESSION_COOKIE_SECURE=false
  VITE_HOST_ARGS=(--host 0.0.0.0)
else
  # An inherited value must not weaken the "as in production" promise of --local.
  unset SERVER_SERVLET_SESSION_COOKIE_SECURE
  VITE_HOST_ARGS=()
fi

mkdir -p "$LOG_DIR"

# --- Start --------------------------------------------------------------------------------------
trap cleanup EXIT
trap 'exit 130' INT TERM

info "Levantando PostgreSQL en localhost:5434"
docker compose up -d --wait postgres

# Demo dates are relative to the day of the first seed (ADR-0028), so every run starts from a
# fresh database of its own; the development database is left alone.
info "Recreando la base $DEMO_DB con datos ficticios de hoy"
docker compose exec -T postgres sh -c "psql -v ON_ERROR_STOP=1 -q -U \"\$POSTGRES_USER\" -d postgres \
  -c 'DROP DATABASE IF EXISTS $DEMO_DB WITH (FORCE)' -c 'CREATE DATABASE $DEMO_DB'"
export DB_URL="jdbc:postgresql://localhost:5434/$DEMO_DB"

info "Levantando el backend en :$BACKEND_PORT (perfiles dev,demo; la primera vez tarda)"
export SPRING_PROFILES_ACTIVE=dev,demo
(cd backend && exec "${MVN[@]}" -B -q spring-boot:run) \
  >"$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

if [ ! -d frontend/node_modules ]; then
  info "Instalando dependencias del frontend (npm ci)"
  npm --prefix frontend ci
fi

info "Levantando el frontend en :$FRONTEND_PORT"
# The ${a[@]+...} form keeps `set -u` happy with an empty array on bash 3.2 (macOS).
npm --prefix frontend run dev -- ${VITE_HOST_ARGS[@]+"${VITE_HOST_ARGS[@]}"} \
  >"$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

wait_for backend "http://localhost:$BACKEND_PORT/actuator/health" "$BACKEND_PID" 300 '"UP"'
wait_for frontend "http://localhost:$FRONTEND_PORT/" "$FRONTEND_PID" 60

LOGIN_PATH="/ingresar?estudio=estudio-demo"
LOCAL_URL="http://localhost:$FRONTEND_PORT"
open_browser "$LOCAL_URL$LOGIN_PATH"

# --- Summary ------------------------------------------------------------------------------------
echo
printf '\033[32mDemo lista.\033[0m Datos 100%% ficticios.\n\n'
echo "  En esta compu:   $LOCAL_URL"
if $LAN; then
  ip="$(lan_ip || true)"
  if [ -n "$ip" ]; then
    echo "  En el celular:   http://$ip:$FRONTEND_PORT$LOGIN_PATH"
    echo "                   (misma red Wi-Fi; si no carga, permití Node en el firewall)"
    echo "  Ojo: cualquiera en esta red puede abrir la app. Usala solo en una red de confianza;"
    echo "       en un Wi-Fi público o con proyector, corré con --local."
  else
    echo "  En el celular:   no pude detectar la IP de la red; buscala en la configuración de red."
  fi
fi
cat <<EOF

  Estudio:  estudio-demo
  Clave:    $DEMO_PASSWORD   (la misma para todos; está en .env)

  Usuarios (backend/src/main/java/ar/gestorpenal/demo/DemoData.java):
    lucia.ejemplo@example.com     Lucía Ejemplo     titular
    martin.prueba@example.com     Martín Prueba     abogado
    julian.muestra@example.com    Julián Muestra    abogado
    sofia.ficticia@example.com    Sofía Ficticia    procuradora

  Logs: .demo-logs/   ·   Ctrl+C para detener.
EOF

# Polls instead of `wait -n`, which bash 3.2 (macOS) lacks.
while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 2
done
fail "el backend o el frontend se detuvo. Mirá los logs en .demo-logs/"
