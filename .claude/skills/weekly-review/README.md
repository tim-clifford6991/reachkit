# The weekly review's timer

The orchestrator installs it on the box. The run is `SKILL.md`; this page is only how it is started. `docs/RUNBOOK.md` names it in one line beside `rk-hygiene.timer`:

> **The weekly review runs on Mondays** (owner, C7). `rk-weekly.timer` at 07:00 UTC, after the weekly pass, runs `/root/ops/reachkit/bin/weekly.sh`, which starts `claude -p "/weekly-review"` on the box's Claude subscription with read-only tools. Its report is `.review/weekly/<date>.md` in the main checkout; the log is `/root/ops/reachkit/log/weekly.log`.

`/root/ops/reachkit/bin/weekly.sh`:

```bash
#!/usr/bin/env bash
# Starts the weekly review. This file is not a copy of the rules; SKILL.md is.
set -euo pipefail
cd /root/projects/reachkitv3
# The subscription, never the API: with a key in the environment, claude bills it.
unset ANTHROPIC_API_KEY
read_tools="Read Grep Glob Task Skill WebFetch Edit(./.review/weekly/**) Bash(git fetch -q origin) Bash(git ls-files src) Bash(xargs wc -l) Bash(sort -n) Bash(tail -21) Bash(mkdir -p .review/weekly) Bash(date -u +%F) Bash(date -u -d '7 days ago' +%F) Bash(curl -fsS https://reachkit.app/api/health) Bash(npm run orphans) Bash(npm run costs -- --stored) Bash(npm outdated --json) Bash(npm audit --omit=dev --json) Bash(node scripts/hygiene.mjs) Bash(node scripts/this-week.mjs) Bash(gh issue list:*) Bash(gh issue view:*) Bash(gh pr list:*) Bash(gh run list:*) Bash(gh api 'repos/tim-clifford6991/reachkit/actions/runs?per_page=100' --jq:*)"
# The only file it may write is under .review/weekly/; a dry run is given no tool that writes to GitHub.
write_tools="Bash(gh issue create:*) Bash(gh issue comment:*) Bash(gh issue edit:*) Bash(gh issue pin:*) Bash(gh label create:*)"
[[ "${1:-}" == "dry-run" ]] && write_tools=""
exec /root/.local/bin/claude -p "/weekly-review ${1:-}" \
  --permission-mode dontAsk \
  --allowedTools "$read_tools $write_tools" \
  --disallowedTools "NotebookEdit Bash(git push:*) Bash(git commit:*) Bash(gh pr merge:*) Bash(npm run panel:*) Bash(gh api -X:*) Bash(gh api --method:*)"
```

Every allowed command is read-only and written exactly as `SKILL.md` runs it. A prefix (`:*`) stays only where no option of that command writes a file or runs another program: `gh issue list`, `gh issue view`, `gh pr list` and `gh run list` only read, and the runs call takes a date in its `--jq` filter and that path has no write method. A command the skill does not run is not on the list.

A dry run by hand: `bash /root/ops/reachkit/bin/weekly.sh dry-run`. It writes the report and the page and files nothing.

`/etc/systemd/system/rk-weekly.service`:

```ini
[Unit]
Description=ReachKit weekly review
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=root
WorkingDirectory=/root/projects/reachkitv3
Environment=HOME=/root
Environment=PATH=/root/.local/bin:/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/env bash /root/ops/reachkit/bin/weekly.sh
StandardOutput=append:/root/ops/reachkit/log/weekly.log
StandardError=append:/root/ops/reachkit/log/weekly.log
```

`/etc/systemd/system/rk-weekly.timer`:

```ini
[Unit]
Description=ReachKit weekly review on Mondays at 07:00 UTC

[Timer]
OnCalendar=Mon *-*-* 07:00:00 UTC
Persistent=true
AccuracySec=1min
Unit=rk-weekly.service

[Install]
WantedBy=timers.target
```

Then `systemctl daemon-reload && systemctl enable --now rk-weekly.timer`.
