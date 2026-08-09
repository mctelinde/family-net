#!/bin/sh
# Update family-net: pull, install, build, swap, restart, health-check.
# On health-check failure, rolls back to the previous build automatically.
set -eu

cd /home/appuser/family-net

echo "[$(date -u +%FT%TZ)] update start"

git pull --ff-only
npm ci --no-audit --no-fund
npm run check
npm run build

# Atomic swap: stage next build as build.new, then rename.
rm -rf build.new
mv build build.new
if [ -d build ]; then
	rm -rf build.prev
	mv build build.prev
fi
mv build.new build

sudo systemctl restart family-net

# Health check — the /api/tools endpoint returns the OpenAPI spec.
sleep 3
if curl -fsS http://127.0.0.1:3000/api/tools >/dev/null; then
	rm -rf build.prev
	echo "[$(date -u +%FT%TZ)] update OK"
	exit 0
fi

# Health check failed — roll back.
echo "[$(date -u +%FT%TZ)] health check failed — rolling back"
sudo systemctl stop family-net
rm -rf build
if [ -d build.prev ]; then
	mv build.prev build
	sudo systemctl start family-net
fi
exit 1
