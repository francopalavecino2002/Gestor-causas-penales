#!/usr/bin/env bash
# Backup of the Docker Compose database (T64): pg_dump in custom format (compressed) to a dated
# file, keeping only the newest N backups of that database. See docs/OPERATIONS.md.
#
#   bash scripts/backup.sh                          # gestor_causas -> ./backups, keeps 14
#   bash scripts/backup.sh --dir D:/copias --keep 30
#   bash scripts/backup.sh --db gestor_demo
#
# BACKUP_DIR, BACKUP_KEEP and DB_NAME (the same variable docker-compose.yml uses) work as defaults.
# The file holds the firm's data, sensitive data included: keep the folder on an encrypted disk.
# shellcheck disable=SC2016 # single-quoted scripts are expanded by the container's sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CALLER="$PWD"
cd "$ROOT"
# Git Bash would rewrite the container paths (/tmp/...) given to docker.exe; host paths are
# converted explicitly with host_path.
export MSYS_NO_PATHCONV=1

info() { printf '\033[36m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }
host_path() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
# The last value of a variable in .env, as docker compose reads it.
dotenv() {
  if [ -f .env ]; then sed -n "s/^$1=//p" .env | tr -d '\r' | tail -n 1; fi
}

BACKUP_DIR="${BACKUP_DIR:-$(dotenv BACKUP_DIR)}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
BACKUP_KEEP="${BACKUP_KEEP:-$(dotenv BACKUP_KEEP)}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
DB="${DB_NAME:-$(dotenv DB_NAME)}"
DB="${DB:-gestor_causas}"

while [ $# -gt 0 ]; do
  case "$1" in
    --dir)
      BACKUP_DIR="${2:?falta la carpeta después de --dir}"
      # A relative --dir is relative to where you ran the command.
      case "$BACKUP_DIR" in /*|[A-Za-z]:*) ;; *) BACKUP_DIR="$CALLER/$BACKUP_DIR" ;; esac
      shift 2 ;;
    --keep) BACKUP_KEEP="${2:?falta el número después de --keep}"; shift 2 ;;
    --db) DB="${2:?falta la base después de --db}"; shift 2 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) fail "opción desconocida: $1 (mirá --help)" ;;
  esac
done

[[ "$BACKUP_KEEP" =~ ^[1-9][0-9]*$ ]] || fail "--keep tiene que ser un número mayor que cero."
[[ "$DB" =~ ^[a-z_][a-z0-9_]{0,50}$ ]] || fail "nombre de base inválido: $DB (minúsculas, números y _)"
command -v docker >/dev/null 2>&1 || fail "falta Docker."
docker info >/dev/null 2>&1 || fail "Docker no está corriendo."

mkdir -p "$BACKUP_DIR"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"
stamp="$(date +%Y%m%d-%H%M%S)"
name="$DB-$stamp.dump"
target="$BACKUP_DIR/$name"
inside="/tmp/$name"

info "Respaldando la base $DB"
docker compose up -d --wait postgres >/dev/null
# Dump inside the container and copy the file out: a binary stream through a pipe is not safe in
# every shell (Windows PowerShell 5.1 re-encodes it), and the bash and PowerShell scripts match.
docker compose exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$1" --format=custom --compress=9 --no-owner --file="$2"' \
  _ "$DB" "$inside"
# Copy to a temporary name first, so a half-copied file never looks like a backup.
docker compose cp "postgres:$inside" "$(host_path "$target.partial")" >/dev/null
docker compose exec -T postgres rm -f "$inside"
[ -s "$target.partial" ] || fail "el respaldo quedó vacío: $target.partial"
mv "$target.partial" "$target"
info "Respaldo listo: $target ($(du -h "$target" | cut -f1))"

# Keep the newest BACKUP_KEEP backups of this database. The names sort by date.
shopt -s nullglob
backups=("$BACKUP_DIR/$DB"-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9].dump)
excess=$(( ${#backups[@]} - BACKUP_KEEP ))
for (( i = 0; i < excess; i++ )); do
  info "Borrando el respaldo viejo ${backups[$i]##*/}"
  rm -f "${backups[$i]}"
done
