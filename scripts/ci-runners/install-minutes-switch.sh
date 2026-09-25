#!/usr/bin/env bash
# scripts/ci-runners/install-minutes-switch.sh — the hourly timer beside rk-deployer and rk-guard
#
# Run once, as root, on the box (#1113). Copies `minutes-switch.sh` to
# /root/ops/reachkit/bin and installs `rk-ci-switch.service` and an hourly
# `rk-ci-switch.timer`. Re-running it updates the copy. It then runs the
# switch once with `--dry-run`, so the first line in the log says what it can
# read. Remove it with:
#   systemctl disable --now rk-ci-switch.timer && rm /etc/systemd/system/rk-ci-switch.*
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }

here="$(cd "$(dirname "$0")" && pwd)"
install -m 0755 "$here/minutes-switch.sh" /root/ops/reachkit/bin/ci-minutes-switch.sh

cat > /etc/systemd/system/rk-ci-switch.service <<'EOF'
[Unit]
Description=ReachKit ops - CI light jobs to the box at 90% of hosted Actions minutes, back when the month resets (#1113)
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
User=root
WorkingDirectory=/root/ops/reachkit
Environment=HOME=/root
Environment=PATH=/root/.local/bin:/usr/local/bin:/usr/bin:/bin
# The day of the month the Actions minutes reset (Settings -> Billing & plans).
Environment=RK_CI_RESET_DAY=25
ExecStart=/usr/bin/env bash /root/ops/reachkit/bin/ci-minutes-switch.sh
StandardOutput=append:/root/ops/reachkit/log/ci-switch.log
StandardError=append:/root/ops/reachkit/log/ci-switch.log
EOF

cat > /etc/systemd/system/rk-ci-switch.timer <<'EOF'
[Unit]
Description=ReachKit ops - hourly CI minutes switch (#1113)
[Timer]
OnCalendar=hourly
Persistent=true
[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now rk-ci-switch.timer
bash /root/ops/reachkit/bin/ci-minutes-switch.sh --dry-run | tee -a /root/ops/reachkit/log/ci-switch.log
systemctl list-timers --no-pager rk-ci-switch.timer
