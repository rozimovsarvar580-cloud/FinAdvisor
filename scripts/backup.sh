#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  scripts/backup.sh backup [output-file]
  scripts/backup.sh restore <backup-file>

Uses the Postgres service in the current Docker Compose project. Set
POSTGRES_USER, POSTGRES_DB, and POSTGRES_SERVICE to override the defaults.
EOF
  exit 2
}

[[ $# -ge 1 && $# -le 2 ]] || usage
action=$1
service=${POSTGRES_SERVICE:-postgres}
db_user=${POSTGRES_USER:-finadvisor}
db_name=${POSTGRES_DB:-finadvisor}

case "$action" in
  backup)
    output=${2:-"backups/${db_name}-$(date -u +%Y%m%dT%H%M%SZ).dump"}
    [[ ! -d "$output" ]] || { echo "Backup output is a directory: $output" >&2; exit 1; }
    mkdir -p "$(dirname "$output")"
    temp="${output}.tmp.$$"
    trap 'rm -f "$temp"' EXIT
    docker compose exec -T "$service" pg_dump -U "$db_user" -d "$db_name" --format=custom --no-owner > "$temp"
    [[ -s "$temp" ]] || { echo "Backup is empty; refusing to publish it." >&2; exit 1; }
    mv -- "$temp" "$output"
    trap - EXIT
    echo "Postgres backup written to $output"
    ;;
  restore)
    [[ $# -eq 2 && -f "$2" ]] || usage
    input=$2
    echo "WARNING: restoring $input replaces objects and data in database '$db_name'."
    docker compose exec -T "$service" pg_restore -U "$db_user" -d "$db_name" --clean --if-exists --no-owner --exit-on-error < "$input"
    echo "Postgres restore completed from $input"
    ;;
  *) usage ;;
esac
