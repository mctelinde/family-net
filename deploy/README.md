# Deploy

Operational artifacts for running Family Net on WSL2 behind Caddy + Tailscale.

Layout:

```
deploy/
├── README.md                          # this file
├── Caddyfile                          # reverse proxy → the app on 127.0.0.1:3000
├── update.sh                          # pull, build, atomic swap, health-check, rollback
├── family-net-backup.sh               # daily tar.gz of data/
├── cron/family-net-backup             # /etc/cron.d entry, runs at 03:23 daily
├── sudoers.d/appuser-family-net       # lets appuser restart family-net without a password
└── systemd/family-net.service         # /etc/systemd/system unit (overrides)
```

## Architecture

```
[family devices]
        │ HTTPS
        ▼
[Tailscale HTTPS] → cert for *.tail0d05f6.ts.net, served to Caddy locally
        │
        ▼
[Caddy :443] ── reverse_proxy ──► [family-net Node :3000] ──► [Ollama :11434]
        │                              (loopback)
        ▼
  /var/log/caddy/family-net.log
```

The app binds only to `127.0.0.1`. Only Caddy (also on loopback) can reach it.
Tailscale is the only path in — no public DNS, no inbound ports.

## Files copied at install time

| Source                                    | Target                                 |
| ----------------------------------------- | -------------------------------------- |
| `deploy/systemd/family-net.service`       | `/etc/systemd/system/family-net.service` |
| `deploy/Caddyfile`                        | `/etc/caddy/Caddyfile`                 |
| `deploy/family-net-backup.sh`             | `/usr/local/bin/family-net-backup.sh`  |
| `deploy/cron/family-net-backup`           | `/etc/cron.d/family-net-backup`        |
| `deploy/sudoers.d/appuser-family-net`     | `/etc/sudoers.d/appuser-family-net`    |

`scripts/setup.sh` does the copying and is idempotent.

## First-run checklist (WSL2)

1. Enable systemd: edit `/etc/wsl.conf` (`[boot] systemd=true`), then `wsl --shutdown` from PowerShell.
2. Install Tailscale in WSL2: `curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up`.
3. Install Ollama: `curl -fsSL https://ollama.com/install.sh | sh && ollama pull qwen2.5-coder:14b`.
4. Install Caddy: follow the official apt repo at https://caddyserver.com/docs/install#debian-ubuntu-derivatives.
5. Clone the repo to `/home/appuser/family-net` (or copy from the Windows path under `/mnt/c/Users/...`).
6. `chown -R appuser:appuser /home/appuser/family-net`.
7. `sudo bash scripts/setup.sh` — installs deps, builds, enables services, sets up cron.
8. Enable Tailscale HTTPS in the admin console: `Settings → ACLs → HTTPS → Enable HTTPS`.
9. `sudo systemctl restart caddy` to pick up the new cert.
10. From a Tailscale-connected device, visit `https://white-knight.tail0d05f6.ts.net`. First run redirects to `/setup`.

## Day-to-day commands

```sh
sudo systemctl status family-net       # service health
sudo journalctl -u family-net -f       # live logs
sudo systemctl restart family-net      # bounce
sudo systemctl status caddy            # reverse proxy
sudo journalctl -u caddy -f
sudo systemctl status ollama           # local AI
ollama list                             # models installed
~/family-net/deploy/update.sh           # deploy latest
sudo -u appuser /usr/local/bin/family-net-backup.sh   # backup now
ls -la /home/appuser/backups/family-net/  # historical backups
```

## Backup verification

Backups are only as good as their last successful restore. Verify monthly:

```sh
sudo -u appuser /usr/local/bin/family-net-backup.sh
mkdir -p /tmp/restore-test
sudo -u appuser tar -xzf /home/appuser/backups/family-net/<latest>.tar.gz -C /tmp/restore-test
ls /tmp/restore-test/entries/ | head
cat /tmp/restore-test/users.json | python3 -m json.tool | head
```

## Hardening notes

- `family-net.service` runs with `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome=read-only`, and `ReadWritePaths` limited to the data directory. The `node` process cannot read arbitrary files under `/home`.
- The Caddyfile logs to `/var/log/caddy/family-net.log` with `roll_size 50mb` and `roll_keep 5` files.
- `family-net-backup.sh` runs at `03:23` daily and keeps 14 days of archives.
- `HOST=127.0.0.1` in `.env` ensures the app is never reachable from the LAN directly — only via Caddy. No Windows Firewall rules for port 3000 needed.
- `NODE_ENV=production` is set by the systemd unit, not `.env` (SvelteKit forbids `NODE_ENV` in `.env`). This is what enables the production server mode in adapter-node and the `secure` cookie flag.
- `SESSION_SECRET` is 32 hex chars; `AGENT_API_KEY` is 24 hex chars. Rotate both if they're ever exposed.
- `appuser` has a scoped, passwordless sudo rule (`/etc/sudoers.d/appuser-family-net`) limited to `systemctl restart|stop|start family-net` — nothing else. This is what lets `deploy/update.sh` bounce the service without a login shell. Verify it with `sudo -u appuser sudo -n systemctl restart family-net`.
