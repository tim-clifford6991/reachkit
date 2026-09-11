---
id: WO-XXX
type: work-order
title: "<title>"
status: draft
ui: no
risk: normal
implements: []
depends-on: []
blocked-by: []
rests-on: []
supersedes: []
---

# WO-XXX — <title>

- Branch: wo/WO-XXX-<slug>
- Estimate: ≤1 day
- Preview: sdlc-factory/docs/design/previews/WO-XXX.html
- Signed-off: <date>

> Front-matter carries status/ui/implements/depends-on/blocked-by/rests-on —
> don't restate them here (0.8.0 moved `ui:` up from these bullets: it is
> the one machine-checked meta field, and only front-matter is parsed).
> `ui:` takes exactly `yes` or `no`, nothing else. `risk:` takes exactly
> `high` or `normal` and absent means `normal` — the planner sets `high`
> only when this order touches a seam the charter names (§8), and a
> high-risk order cannot reach `done` without a `Mutation:` line in the
> validation section covering it. Enumerate every ID in an
> edge field; an ellipsis (`BP-001 … BP-096`) is refused and reported as an
> `ellipsis-range` finding, never expanded. Keep `Preview:` and
> `Signed-off:` only when `ui: yes`; delete both otherwise — these bullets,
> like `Branch:` and `Estimate:`, are prose for humans; the parser reads
> none of them.

## Goal
<one sentence>

## File plan
| File | New/Modify | Change |
|---|---|---|

## Interfaces
Consumes: … / Exposes: … (verbatim from BP)

## Steps
1. …

## Test plan
| Acceptance criterion (verbatim from REQ) | Test |
|---|---|

## Out of scope
- …

## Rollback
<how to revert safely>

## Log
> The checkpoint any agent resumes from (constitution rule 6.1). Five
> line forms, newest last: `created — <agent>`, `started — <agent>`,
> `finished — <agent> — <one line>`, `failed — <agent> — <why> — next:
> <the step to resume at>`, and `opened — migration <version>` — the
> migration-only form a `factory upgrade` backfill uses when it adds this
> section to a work order (or this template) that predates rule 6.1,
> rather than fabricating a history of runs that never happened. A failed
> run leaves `status` unchanged — there is no `blocked` in the vocabulary
> above; this line is the record. Body text, not front-matter — it carries
> no edge the registry projects.
- <YYYY-MM-DD> created — planner

## Validation report (appended by validator)
> Once this WO reaches `status: done`, its LATEST `## TST-###` section must
> also carry a `Regression:` line — what was re-checked alongside the new
> work, not just the new work itself: `Regression: <n> files ·
> <REQ-… list | none> re-checked — pass` or `Regression: <n> files ·
> <REQ-… list | none> re-checked — findings: <one line>`. Missing it is
> `tst-without-regression` (warn).
