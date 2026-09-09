---
description: Land an approved PR into main with the landing chain — the master's close of the loop
argument-hint: <pr number>
allowed-tools: Bash
---

Land PR #$ARGUMENTS (docs/PROCESS.md §3).

1. `gh pr view $ARGUMENTS --json state,mergeable,statusCheckRollup,body,files` — the PR must be open and mergeable, the body must contain exactly one `Closes #N`, and the `closes one issue · done-when ticked` check must be green. A PR touching an owner file must be a docs PR by the master; otherwise stop and report.
2. For a UI PR, confirm the body carries the token table and the side-by-side render against the approved set, and that the master has compared them — never land a screen unseen.
3. Landing order: `fix-first` and token/allow-list PRs first; if this PR adds an exemption row naming a file another open PR rewrites, land the rewriting PR first and have this one rebase.
4. `scripts/land.sh $ARGUMENTS` in a foreground shell or a Herdr pane (never a harness background job). It updates the branch if behind, waits for every check including Vercel, merges with a merge commit and deletes the branch.
5. Report: PR merged, issue closed, branch deleted, the deploy state from the `Vercel` check. If the closed issue's milestone now has zero open issues, say so — the owner closes milestones.
