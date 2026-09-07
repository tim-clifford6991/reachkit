#!/usr/bin/env bash
# scripts/db-substrate/reap.sh
#
# Every substrate stack whose worktree is gone, stopped.
#
# One line, because the reaper *is* `down.sh --orphans` and two
# implementations of one thing is how they come to disagree. This exists so
# the brief's worktree-removal step and the README have a name to say that
# does only this, and cannot be mistaken for the flag that also drops a
# database.
#
#     scripts/db-substrate/reap.sh
#
# See `down.sh`'s header for what an orphan is and why 41 of them held
# 1.66 GB on 2026-09-07 (issue #273).
set -euo pipefail
exec "$(dirname "$0")/down.sh" --orphans
