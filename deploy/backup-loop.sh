#!/bin/sh
set -eu
while true; do
  if ! sh /ops/backup-once.sh; then
    printf '{"evento":"backup_falhou"}\n' >&2
  fi
  sleep 86400
done
