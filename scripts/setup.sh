#!/bin/sh
# First-run installer for family-net on WSL2.
# Idempotent: safe to re-run. Creates appuser, builds the app, installs
# systemd unit, Caddyfile, backup script, and cron entry.
set -eu

APP_USER=appuser
APP_DIR=/home/$APP_USER/family-net
BACKUP_DIR=/home/$APP_USER/backups/family-net

require_root() {
	if [ "$(id -u)" -ne 0 ]; then
		echo "must run as root (use sudo)" >&2
		exit 1
	fi
}

require_node() {
	if ! command -v node >/dev/null 2>&1; then
		echo "node not found — install Node 20+ first (e.g. via nvm)" >&2
		exit 1
	fi
	NODE_MAJOR=$(node -v | sed 's/^v\([0-9]*\).*/\1/')
	if [ "$NODE_MAJOR" -lt 20 ]; then
		echo "node $NODE_MAJOR is too old — need 20+" >&2
		exit 1
	fi
}

create_appuser() {
	if id "$APP_USER" >/dev/null 2>&1; then
		echo "→ user $APP_USER exists"
	else
		echo "→ creating user $APP_USER"
		useradd --system --create-home --shell /bin/bash "$APP_USER"
	fi
}

prepare_paths() {
	echo "→ preparing paths"
	install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR"
	install -d -o "$APP_USER" -g "$APP_USER" "$BACKUP_DIR"

	# This script may be running from a clone under /home/<somedev>/family-net.
	# Move/copy the repo into /home/appuser/family-net if it isn't already there.
	HERE=$(cd "$(dirname "$0")/.." && pwd)
	if [ "$HERE" != "$APP_DIR" ]; then
		echo "→ syncing repo from $HERE to $APP_DIR"
		rsync -a --delete --exclude='.git' --exclude='node_modules' --exclude='build' "$HERE/" "$APP_DIR/"
		chown -R "$APP_USER:$APP_USER" "$APP_DIR"
	fi
}

build_app() {
	echo "→ running npm ci (as $APP_USER)"
	sudo -u "$APP_USER" -H bash -c "cd $APP_DIR && npm ci --no-audit --no-fund"

	echo "→ running npm run build (as $APP_USER)"
	sudo -u "$APP_USER" -H bash -c "cd $APP_DIR && npm run build"
}

install_unit() {
	echo "→ installing systemd unit"
	install -m 0644 "$APP_DIR/deploy/systemd/family-net.service" /etc/systemd/system/family-net.service
	systemctl daemon-reload
	systemctl enable family-net.service
	systemctl restart family-net.service
}

install_caddy() {
	if [ ! -f /etc/caddy/Caddyfile ]; then
		echo "→ Caddy not installed — skipping Caddyfile install"
		echo "  (install Caddy first: https://caddyserver.com/docs/install)"
		return
	fi
	echo "→ installing Caddyfile"
	# Back up the default Caddyfile if it's still the package default
	if grep -q '^# Snippet' /etc/caddy/Caddyfile 2>/dev/null; then
		cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.orig
	fi
	install -m 0644 "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
	install -d -o caddy -g caddy /var/log/caddy
	systemctl enable caddy
	systemctl restart caddy
}

install_backup() {
	echo "→ installing backup script"
	install -m 0755 "$APP_DIR/deploy/family-net-backup.sh" /usr/local/bin/family-net-backup.sh

	echo "→ installing cron entry"
	install -m 0644 "$APP_DIR/deploy/cron/family-net-backup" /etc/cron.d/family-net-backup
}

make_executable() {
	# Ensure repo scripts are executable in place
	chmod +x "$APP_DIR/deploy/update.sh" "$APP_DIR/deploy/family-net-backup.sh"
}

main() {
	require_root
	require_node
	create_appuser
	prepare_paths
	make_executable
	build_app
	install_unit
	install_caddy
	install_backup

	echo ""
	echo "✔ installation complete"
	echo ""
	echo "Next steps:"
	echo "  1. Verify:  sudo systemctl status family-net"
	echo "  2. Logs:    sudo journalctl -u family-net -f"
	echo "  3. Backup:  sudo -u $APP_USER /usr/local/bin/family-net-backup.sh"
	echo "  4. Tailscale HTTPS: enable in admin console, then:"
	echo "       sudo systemctl restart caddy"
	echo "  5. Visit:   https://white-knight.tail0d05f6.ts.net"
}

main "$@"
