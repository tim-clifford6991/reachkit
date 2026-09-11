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
- Signed-off: <date> — v<n>

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
> none of them. `Preview:` names the sheet file, which is the record; the
> published page's URL lives in the `## Log` below, where the checker
> looks for it (rule 7.3). `Signed-off:` is the librarian's line alone,
> written from the owner's word on that page, and it names the version
> the word was given on.

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
> The checkpoint any agent resumes from (constitution rule 6.1). Eight
> line forms, newest last: `created — <agent>`, `started — <agent>`,
> `finished — <agent> — <one line>`, `failed — <agent> — <why> — next:
> <the step to resume at>`, `pack — <n> items · <n> artifacts · <n> files
> · <n> KB` (rule 4.5: what one dispatch was allowed to read, written by
> the dispatching verb from `factory-console pack`),
> `preview — design-guardian — v<n> — <url>`
> (rule 7.3: one line per publication of this WO's preview sheet — the
> only line here a checker reads, `preview-without-url`), `ruled — owner
> — <one line>` (the owner's own waiver of a gate this order does not
> meet, written by the librarian; the only way past the preview gate),
> and `opened — migration <version>` — the
> migration-only form a `factory upgrade` backfill uses when it adds this
> section to a work order (or this template) that predates rule 6.1,
> rather than fabricating a history of runs that never happened. A failed
> run leaves `status` unchanged — there is no `blocked` in the vocabulary
> above; this line is the record. Body text, not front-matter — it carries
> no edge the registry projects.
- <YYYY-MM-DD> created — planner

## Validation report (appended by validator)
> Empty on most work orders. Since 0.13.2 the validator writes ONE
> `## TST-###` section per WAVE, into the wave's FIRST order, opening with
> `Validates: WO-###, WO-###, …` — every order the wave's row names. The
> parser mints one `validates` edge per id on that line, so an order whose
> own body has no TST section is still validated, by the section that
> names it. A per-order section is still legal for a surgical re-check;
> it is not what closes a wave.
>
> Once this WO reaches `status: done`, the LATEST `## TST-###` section
> validating it must
> also carry a `Regression:` line — what was re-checked alongside the new
> work, not just the new work itself: `Regression: <n> files ·
> <REQ-… list | none> re-checked — pass` or `Regression: <n> files ·
> <REQ-… list | none> re-checked — findings: <one line>`. Missing it is
> `tst-without-regression` (warn).
