---
name: resume
description: Rebuilds an orchestrating session's picture of ReachKit delivery from GitHub, git and the box after its context was lost or compacted — open pull requests and their checks, what waits on release QA or the owner, the Launch queue, worktrees and Herdr tabs. Read-only. Use at the start of an orchestration session, after a compaction, or when asked "where are we".
---

# Resume

The repository and GitHub are the only record (`docs/PROCESS.md` › Source of truth). Nothing from a previous chat is assumed. Every step reads; none writes, merges, deploys or spends.

## 1. Read the record

Run these together:

```bash
git -C /root/projects/reachkitv3 fetch -q origin
git -C /root/projects/reachkitv3 log origin/main --since="3 days ago" --format="%h %s"
gh pr list --state open --json number,title,headRefName,headRefOid,mergeable,isDraft,statusCheckRollup,updatedAt \
  --jq '.[] | [.number, .headRefName, .mergeable, ([.statusCheckRollup[]? | select(.conclusion != "SUCCESS" and .conclusion != "SKIPPED" and .conclusion != "NEUTRAL") | "\(.name // .context):\(if (.conclusion // "") == "" then (.status // .state) else .conclusion end)"] | join(",")), .title] | @tsv'
gh issue list --label blocked-on-owner --state open --json number,title --jq '.[] | "\(.number)\t\(.title)"'
gh issue list --milestone Launch --state open --json number,title,labels --jq '.[] | "\(.number)\t\([.labels[].name] | join(","))\t\(.title)"'
gh issue list --state open --search "in:title hygiene OR nightly OR layout OR flaky" --json number,title --jq '.[] | "\(.number)\t\(.title)"'
npm --prefix /root/projects/reachkitv3 run --silent box
herdr tab list 2>/dev/null || true
node /root/projects/reachkitv3/scripts/this-week.mjs --days 3
```

For each open pull request, read only the newest comments: `gh pr view <n> --json comments --jq '.comments[-3:][] | "\(.author.login) \(.createdAt)\n\(.body)"'`. A release QA verdict names a head SHA; a GO is stale once the head has moved.

## 2. State the picture

Write it in this order, one line each, with the number:

1. **Ready to merge:** GO from release QA on the current head, every gate green, no conflict.
2. **Waiting on release QA:** green, no verdict on the current head.
3. **Red or conflicting:** the failing check or the conflict, and whose tab owns it (`rk-<N>`).
4. **Merged, not yet PASS:** merged since the last release QA PASS comment.
5. **Waiting on the owner:** `blocked-on-owner`.
6. **Next:** open Launch issues not blocked and with no open pull request, at most three engineers at once (PROCESS › Testing budget 5).
7. **Box:** worktrees with no open pull request, dirty or behind, from `npm run box`; tabs with no issue.
8. **Alarms:** open `[hygiene]`, `[nightly]`, `[layout]` and flaky issues.

Something that could not be read is said as not read, never left out. Then stop and wait: resuming does not merge, start an engineer or comment.
