#!/bin/sh
# Daily backup of family-net data directory.
# Installed at /usr/local/bin/family-net-backup.sh and run via cron as `appuser`.
set -eu

STAMP=$(date -u +%Y-%m-%dT%H%M%SZ)
SRC=/home/appuser/family-net/data
DST=/home/appuser/backups/family-net
LOG=/home/appuser/backups/backup.log

mkdir -p "$DST"
echo "[$(date -u +%FT%TZ)] backup start" >> "$LOG"

tar -czf "$DST/$STAMP.tar.gz" -C "$SRC" . && RC=$? || RC=$?

if [ "${RC:-1}" -ne 0 ]; then
	echo "[$(date -u +%FT%TZ)] backup FAILED (tar exit $RC)" >> "$LOG"
	rm -f "$DST/$STAMP.tar.gz"
	exit 1
fi

# Retention: 14 days
find "$DST" -name '20*-T*-*.tar.gz' -mtime +14 -delete

SIZE=$(du -h "$DST/$STAMP.tar.gz" | cut -f1)
echo "[$(date -u +%FT%TZ)] backup OK: $STAMP.tar.gz ($SIZE)" >> "$LOG"
