#!/bin/bash
set -e

BACKUP_DIR="/home/brent/jr-inventory/backups"
RETENTION_DAYS=7
DATE=$(date +%Y-%m-%d_%H-%M-%S)

mkdir -p "$BACKUP_DIR"

docker compose -f /home/brent/jr-inventory/docker-compose.yml exec -T db pg_dump -U postgres jr_inventory | gzip > "$BACKUP_DIR/jr_inventory_$DATE.sql.gz"

find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# Off-site sync to Backblaze B2
rclone sync "$BACKUP_DIR" mycloud:jr-inventory-backups --delete-after

echo "Backup completed: jr_inventory_$DATE.sql.gz"
