# scripts

One-off installer scripts. Run on the WSL2 host after cloning the repo.

- **`setup.sh`** — idempotent first-run installer. Creates `appuser`, syncs the repo into `/home/appuser/family-net`, builds, installs systemd unit + Caddyfile + backup script + cron. Run with `sudo bash scripts/setup.sh`. See `../deploy/README.md` for prerequisites (Tailscale, Ollama, Caddy, Node 20+).
