#!/usr/bin/env bash
# scripts/ci-runners/install-light-runner.sh — the box's second runner, for light jobs only
#
# Run once, as root, on the box (owner, 2026-09-25, #1113; revises #1035 for
# the light jobs). It installs `reachkit-light` beside `reachkit-box`:
#
#   * a copy of `/home/ghrunner/actions-runner`'s binaries in
#     `/home/ghrunner/actions-runner-light`, run by the same `ghrunner` user;
#   * registered to the repository with the label `reachkit-light` and **not**
#     `reachkit`, so the browser job (`runs-on: [self-hosted, reachkit]`)
#     never lands here and two browser sweeps never run at once;
#   * a systemd drop-in capping it at 1.5 GB (`MemoryMax`, with up to 1 GB
#     of swap so a typecheck peak is slowed rather than killed) at the lowest
#     CPU and IO priority, so it cannot starve the browser job or the
#     implementation agents — `rk-guard` reports LOW MEMORY below 1.2 GB
#     available on the 7.6 GB box, and this ceiling keeps the two runners
#     together above that.
#
# It takes jobs only when `CI_LIGHT_RUNNER` is `["self-hosted","reachkit-light"]`
# (`.github/workflows/ci.yml`). Re-running it replaces the registration.
# Remove it with:
#   cd /home/ghrunner/actions-runner-light && ./svc.sh stop && ./svc.sh uninstall
#   sudo -u ghrunner ./config.sh remove --token "$(gh api -X POST repos/tim-clifford6991/reachkit/actions/runners/remove-token --jq .token)"
set -euo pipefail

REPO="tim-clifford6991/reachkit"
NAME="reachkit-light"
SRC=/home/ghrunner/actions-runner
DIR=/home/ghrunner/actions-runner-light
UNIT="actions.runner.${REPO/\//-}.${NAME}.service"

[[ $EUID -eq 0 ]] || { echo "run as root" >&2; exit 1; }
[[ -x "$SRC/config.sh" ]] || { echo "no runner at $SRC to copy the binaries from" >&2; exit 1; }

# The binaries and the runner's env, never the first runner's registration,
# credentials or work tree.
mkdir -p "$DIR"
rsync -a --exclude=_work --exclude=_diag --exclude=.runner --exclude='.credentials*' \
  --exclude=.service "$SRC/" "$DIR/"
chown -R ghrunner:ghrunner "$DIR"

token="$(gh api -X POST "repos/${REPO}/actions/runners/registration-token" --jq .token)"
(cd "$DIR" && sudo -u ghrunner ./config.sh --unattended --replace \
  --url "https://github.com/${REPO}" --token "$token" \
  --name "$NAME" --labels "$NAME" --work _work)

(cd "$DIR" && ./svc.sh install ghrunner)

mkdir -p "/etc/systemd/system/${UNIT}.d"
cat > "/etc/systemd/system/${UNIT}.d/limits.conf" <<'EOF'
[Service]
# The light runner (#1113): typecheck, lint, unit, the db suites, audit.
# 1.5 GB, lowest priority, so it cannot starve the browser job on
# reachkit-box or the implementation agents (rk-guard: LOW MEMORY < 1.2 GB).
MemoryMax=1536M
MemorySwapMax=1G
Nice=19
CPUWeight=20
IOWeight=20
EOF
systemctl daemon-reload
systemctl restart "$UNIT"
systemctl --no-pager --lines=0 status "$UNIT"
gh api "repos/${REPO}/actions/runners" --jq '.runners[] | "\(.name)  \(.status)  \([.labels[].name] | join(","))"'
