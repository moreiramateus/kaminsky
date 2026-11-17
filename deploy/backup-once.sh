#!/bin/sh
set -eu
umask 077
mkdir -p /backups
stamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
archive="/backups/kaminsky-$stamp.dump"
restore_db="verify_$stamp"
cleanup() {
  dropdb --if-exists "$restore_db" >/dev/null 2>&1 || true
}
trap cleanup EXIT
pg_dump --format=custom --file="$archive.partial" "$PGDATABASE"
mv "$archive.partial" "$archive"
createdb "$restore_db"
pg_restore --exit-on-error --no-owner --no-privileges --dbname="$restore_db" "$archive"
count=$(psql --set=ON_ERROR_STOP=1 --dbname="$restore_db" -Atc 'SELECT count(*) FROM estacoes')
cleanup
trap - EXIT
sha256sum "$archive" > "$archive.sha256"
date -u +%s > /backups/last-success
printf '{"evento":"backup_restaurado_e_validado","arquivo":"%s","registros_restaurados":%s}\n' "$(basename "$archive")" "$count"
# Retenção só de arquivos de backup produzidos por este script.
find /backups -maxdepth 1 -type f -name 'kaminsky-*.dump*' -mtime +14 -delete
