#!/usr/bin/env bash
# Smoke test of scripts/backup.sh and scripts/restore.sh (T64) against a seeded database. CI runs
# it after scripts/e2e-demo.sh, which leaves `gestor_e2e` with the fictitious demo data and the
# backend stopped. Locally: bash scripts/e2e-demo.sh && bash scripts/backup-smoke.sh
# shellcheck disable=SC2016 # single-quoted scripts are expanded by the container's sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export MSYS_NO_PATHCONV=1

DB="${1:-gestor_e2e}"
DIR="$ROOT/.demo-logs/backup-smoke"

info() { printf '\033[36m==>\033[0m %s\n' "$*"; }
fail() { printf '\033[31mSmoke test failed:\033[0m %s\n' "$*" >&2; exit 1; }

# One value from a query on the given database.
value() {
  docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -q -tA -U "$POSTGRES_USER" -d "$1" -c "$2"' _ "$1" "$2"
}

rm -rf "$DIR"
mkdir -p "$DIR"

cases="$(value "$DB" "SELECT count(*) FROM case_file")"
[ "$cases" -gt 0 ] || fail "$DB has no cases: run scripts/e2e-demo.sh first."
info "$DB has $cases cases"

info "Three backups keeping two"
shopt -s nullglob
first=""
for _ in 1 2 3; do
  bash scripts/backup.sh --db "$DB" --dir "$DIR" --keep 2
  [ -n "$first" ] || { made=("$DIR/$DB"-*.dump); first="${made[0]}"; }
  sleep 1 # the names have one-second resolution
done
backups=("$DIR/$DB"-*.dump)
[ "${#backups[@]}" -eq 2 ] || fail "expected 2 backups after rotation, found ${#backups[@]}."
[ ! -e "$first" ] || fail "rotation kept the oldest backup (${first##*/})."
newest="${backups[1]}"

info "Changing the database after the backup"
value "$DB" "CREATE TABLE smoke_marker (id int)" >/dev/null

info "Without --yes and without a terminal to confirm, nothing is restored"
if bash scripts/restore.sh "$newest" --db "$DB" </dev/null; then
  fail "a restore ran without confirmation."
fi
[ "$(value "$DB" "SELECT count(*) FROM pg_tables WHERE tablename = 'smoke_marker'")" = "1" ] \
  || fail "a refused restore changed $DB."

info "A broken file is refused and leaves the database as it was"
printf 'not a backup' >"$DIR/broken.dump"
if bash scripts/restore.sh "$DIR/broken.dump" --db "$DB" --yes; then
  fail "restoring a broken file succeeded."
fi
[ "$(value "$DB" "SELECT count(*) FROM pg_tables WHERE tablename = 'smoke_marker'")" = "1" ] \
  || fail "a failed restore changed $DB."

info "Restoring ${newest##*/}"
bash scripts/restore.sh "$newest" --db "$DB" --yes
[ "$(value "$DB" "SELECT count(*) FROM case_file")" = "$cases" ] || fail "the case count changed."
[ "$(value "$DB" "SELECT count(*) FROM pg_tables WHERE tablename = 'smoke_marker'")" = "0" ] \
  || fail "the change made after the backup is still there."
[ "$(value "$DB" "SELECT count(*) FROM flyway_schema_history WHERE success")" -gt 0 ] \
  || fail "the Flyway history was not restored."
[ "$(value "${DB}_previa" "SELECT count(*) FROM pg_tables WHERE tablename = 'smoke_marker'")" = "1" ] \
  || fail "the replaced database was not kept as ${DB}_previa."

info "Backup and restore work"
