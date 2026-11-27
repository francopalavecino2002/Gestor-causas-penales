#!/usr/bin/env bash
# Restore of a backup made by scripts/backup.sh (T64). See docs/OPERATIONS.md.
#
#   bash scripts/restore.sh backups/gestor_causas-20261127-230000.dump
#   bash scripts/restore.sh backups/gestor_demo-20261127-230000.dump --db gestor_demo
#   bash scripts/restore.sh <file> --yes     # no question (scripts and CI only)
#
# It loads the backup into a new database and, only when that worked, swaps it in: the current
# database is kept as <db>_previa (replacing the one of the previous restore), so a failed or
# mistaken restore loses nothing. Stop the backend first: its connections are closed.
# shellcheck disable=SC2016 # single-quoted scripts are expanded by the container's sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Git Bash would rewrite the container paths (/tmp/...) given to docker.exe; host paths are
# converted explicitly with host_path.
export MSYS_NO_PATHCONV=1

info() { printf '\033[36m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }
host_path() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
# The last value of a variable in .env, as docker compose reads it.
dotenv() {
  if [ -f "$ROOT/.env" ]; then sed -n "s/^$1=//p" "$ROOT/.env" | tr -d '\r' | tail -n 1; fi
}

DB="${DB_NAME:-$(dotenv DB_NAME)}"
DB="${DB:-gestor_causas}"
FILE=""
ASSUME_YES=false

while [ $# -gt 0 ]; do
  case "$1" in
    --db) DB="${2:?falta la base después de --db}"; shift 2 ;;
    --yes) ASSUME_YES=true; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    -*) fail "opción desconocida: $1 (mirá --help)" ;;
    *) [ -z "$FILE" ] || fail "indicá un solo archivo."; FILE="$1"; shift ;;
  esac
done

[ -n "$FILE" ] || fail "indicá el archivo de respaldo (mirá --help)."
[ -s "$FILE" ] || fail "no existe o está vacío: $FILE"
FILE="$(cd "$(dirname "$FILE")" && pwd)/$(basename "$FILE")"
# Validated, so it is safe inside the SQL below (identifiers cannot be bound as parameters).
[[ "$DB" =~ ^[a-z_][a-z0-9_]{0,50}$ ]] || fail "nombre de base inválido: $DB (minúsculas, números y _)"
command -v docker >/dev/null 2>&1 || fail "falta Docker."
docker info >/dev/null 2>&1 || fail "Docker no está corriendo."
cd "$ROOT"

STAGING="${DB}_restaurando"
PREVIOUS="${DB}_previa"

if ! $ASSUME_YES; then
  [ -t 0 ] || fail "sin terminal no puedo pedir confirmación: agregá --yes si estás seguro."
  printf 'Vas a reemplazar la base %s con %s.\n' "$DB" "${FILE##*/}"
  printf 'La actual queda guardada como %s. Cerrá el backend antes de seguir.\n' "$PREVIOUS"
  read -r -p "Para confirmar, escribí el nombre de la base ($DB): " answer
  [ "$answer" = "$DB" ] || fail "no coincide: no se restauró nada."
fi

# Runs one SQL statement as the compose superuser on the maintenance database.
sql() {
  docker compose exec -T postgres sh -c \
    'psql -v ON_ERROR_STOP=1 -q -tA -U "$POSTGRES_USER" -d postgres -c "$1"' _ "$1"
}

docker compose up -d --wait postgres >/dev/null
inside="/tmp/restore-$$.dump"
docker compose cp "$(host_path "$FILE")" "postgres:$inside" >/dev/null

info "Cargando el respaldo en una base nueva ($STAGING)"
sql "DROP DATABASE IF EXISTS $STAGING WITH (FORCE)"
sql "CREATE DATABASE $STAGING"
if ! docker compose exec -T postgres sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --exit-on-error "$2"' _ "$STAGING" "$inside"; then
  docker compose exec -T postgres rm -f "$inside" || true
  sql "DROP DATABASE IF EXISTS $STAGING WITH (FORCE)" || true
  fail "el respaldo no se pudo cargar. La base $DB quedó como estaba."
fi
docker compose exec -T postgres rm -f "$inside"

info "Reemplazando $DB (la actual queda como $PREVIOUS)"
if [ "$(sql "SELECT count(*) FROM pg_database WHERE datname = '$DB'")" = "1" ]; then
  # No new connections while the current ones close; closing is asynchronous, so the rename is
  # retried for a few seconds.
  sql "ALTER DATABASE $DB WITH ALLOW_CONNECTIONS false"
  sql "DROP DATABASE IF EXISTS $PREVIOUS WITH (FORCE)"
  renamed=false
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sql "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB'" >/dev/null
    if sql "ALTER DATABASE $DB RENAME TO $PREVIOUS" 2>/dev/null; then renamed=true; break; fi
    sleep 1
  done
  if ! $renamed; then
    sql "ALTER DATABASE $DB WITH ALLOW_CONNECTIONS true"
    fail "algo sigue conectado a $DB: quedó como estaba. Los datos restaurados están en $STAGING; cerrá el backend y probá de nuevo."
  fi
  sql "ALTER DATABASE $PREVIOUS WITH ALLOW_CONNECTIONS true"
fi
sql "ALTER DATABASE $STAGING RENAME TO $DB"
info "Listo: $DB tiene los datos de ${FILE##*/}. Ya podés arrancar el backend."
