#!/bin/bash
# pipefail: if pg_dump fails, the whole pipeline fails (not just gzip's exit status).
set -euo pipefail

# The app runs on rootless Docker. Cron and non-interactive SSH don't load
# ~/.bashrc or always use the right context, so point at the rootless daemon
# explicitly unless DOCKER_HOST is already set.
export DOCKER_HOST="${DOCKER_HOST:-unix:///run/user/$(id -u)/docker.sock}"

BACKUP_DIR="/home/brent/jr-inventory/backups"
RETENTION_DAYS=7
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILE="$BACKUP_DIR/jr_inventory_$DATE.sql.gz"

mkdir -p "$BACKUP_DIR"

# Never leave a partial or empty file behind: it would look like a real backup
# and be synced off-site.
trap 'rm -f "$FILE"' ERR

docker compose -f /home/brent/jr-inventory/docker-compose.yml exec -T db pg_dump -U postgres jr_inventory | gzip > "$FILE"

# A real dump of this schema is many KB; anything tiny means the dump produced nothing.
DUMP_BYTES=$(gunzip -c "$FILE" | wc -c)
if [ "$DUMP_BYTES" -lt 1000 ]; then
  rm -f "$FILE"
  echo "Backup FAILED: dump was only $DUMP_BYTES bytes (is the db container running on $DOCKER_HOST?)" >&2
  exit 1
fi

find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# Off-site sync to Backblaze B2
rclone sync "$BACKUP_DIR" mycloud:jr-inventory-backups --delete-after

echo "Backup completed: $(basename "$FILE") ($DUMP_BYTES bytes uncompressed)"
