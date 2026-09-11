# REQ-003 — requirement cleanup, 2026-08-30 (free-funnel merge 2)

Merge decided by the owner's merge map. The count rule was inapplicable:
`blueprints/` and `work-orders/` hold no artifact, so no front-matter
`satisfies:`/`implements:` line names REQ-003 or REQ-015 — both counts are 0, a
tie the lower id breaks in favour of REQ-003, which is also the owner's survivor.

## What merged

| id | before | after |
|---|---|---|
| REQ-003 (survivor) | 5 criteria, 1 `rests-on`, `status: draft` | 12 criteria, 3 `rests-on`, `status: draft`, `supersedes: [REQ-015]` |
| REQ-015 | 7 criteria, 2 `rests-on`, 2 open `REVIEW(...)` | `status: superseded`, retired in place |

12 criteria in, 12 out. Nothing collapsed, nothing paraphrased. Grounds: one
behaviour — the scan stops early and says so; the 60/90-second ceilings and the
spend and rate ceilings are the same promise met at different bounds.

## Title

Was: "The scan reports its progress and returns a readable report within 60
seconds". Now: "The scan ends at a bounded moment — a report inside 60 seconds,
or one written line naming the limit it met".

## Criterion mapping — every criterion carried verbatim

| survivor | from | citation repoints inside the criterion |
|---|---|---|
| 1–3 | REQ-003 c1–c3 | — |
| 4 | REQ-003 c4 | "the retry window is REQ-012's" → "REQ-001's" |
| 5 | REQ-003 c5 | "(REQ-005)" → "(REQ-004)" |
| 6 | REQ-015 c1 | "(REQ-003 c1)" → "(criterion 1)" |
| 7 | REQ-015 c2 | — |
| 8 | REQ-015 c3 | — |
| 9 | REQ-015 c4 | — |
| 10 | REQ-015 c5 | — |
| 11 | REQ-015 c6 | "(REQ-005)" → "(REQ-004)" |
| 12 | REQ-015 c7 | "criterion 1 or 2" → "criterion 6 or 7"; "(REQ-002)" → "(REQ-001 criterion 5)"; "REQ-002 criterion 8, \"starts no scan for anyone\"" → "REQ-002 criterion 3"; "REQ-012 criterion 7" → "REQ-001 criterion 18" |

One verbatim quotation of sibling prose (criterion 12) converted to a citation
under the corpus ruling.

## The two `REVIEW(...)` lines REQ-015 carried

**Died — the seam it rested on is gone.** Verbatim:

> - [ ] REVIEW(gap): criterion 7 covers only a visitor refused under criteria 1 or
>       2. A visitor opening the report address of a domain with no stored report
>       while the day's ceiling is reached or scanning is switched off (criterion
>       3) has no criterion saying what loads there or that no scan starts —
>       criterion 3's Given is a visitor who "tries to scan", and REQ-002 c3 no
>       longer maps address states, naming this requirement as one of the owners.

The finding turned on "tries to scan" being undefined across a REQ boundary.
Inside one requirement it is defined: survivor criterion 1 enumerates the three
ways a scan starts — a landing submission, a first visit to a shared report
address, a re-measurement — so criterion 8 now reaches the address visit, and
what loads there is criterion 8's own written line, backed by REQ-001 criterion
5's promise that the address never ends in a blank page, a 404 or an unhandled
error. Nothing is left unowned.

**Survives, restated with current citations on the survivor.** Verbatim as it
stood:

> - [ ] REVIEW(gap): criterion 6 has no case for the spend ceiling being reached
>       while a measurement a score driver depends on is still outstanding. "Only
>       optional measurements are skipped" then leaves the build to either exceed
>       the ceiling or drop a driver, and REQ-005 c4 contemplates a driver being
>       among the work cut off at this very ceiling.

This is not a seam against REQ-003 or REQ-002, as the merge map supposed: it is a
substantive contradiction between what is now REQ-003 criterion 11 and REQ-004
criterion 9, and those two texts land in *different* survivors, so no merge in
this pass closes it. It is not mine to derive either — both outcomes change what
the reader sees at the top of the report (a score, or a "—"), which is a
customer-visible verdict and the owner's under §1. Carried forward with the
citation repointed to REQ-004 criterion 9 and the escalation stated.

## Front-matter

- `depends-on`: REQ-003 [REQ-002] ∪ REQ-015 [REQ-001] = [REQ-001, REQ-002]. Both
  edges are live — criterion 12 cites both.
- `rests-on`: union of all three claims, no duplicates, dispositions unchanged
  (two `open`, one `confirmed`).
- Priority: Must on both; survivor Must.

## Non-goals

Union of both lists. REQ-015's "No waitlist, queue position, or captcha on the
free scan" overlapped REQ-003's "No queue position, percentage estimate, or
countdown timer": the overlapping term was dropped from the REQ-015 line, which
now reads "No waitlist or captcha on the free scan" — the only edit to a non-goal
in this merge, and it removes a duplicate rather than a promise. The evaluation-
order deferral was kept and repointed ("REQ-002 criterion 8's" → "REQ-002
criterion 3's").

T1 check: no non-goal here hides a promise. "No spend, cost or cap figure shown
to a visitor" is the closest, and it is an exclusion the customer cannot notice
the absence of — what they are owed when a bound is met is criteria 6–8 and 11,
in writing. No T1 promotion in this merge.

## Rule 4.2 — what I think is wrong

The merge map called both of REQ-015's `REVIEW` lines seam findings against
REQ-003 and REQ-002. The second one is not: it names REQ-005, and REQ-005 merges
into REQ-004 in merge 4, not into this survivor. Killing it here would have
retired a live contradiction between two surviving requirements. It stands, and
it wants `/decide` or an owner ruling, not another review round (§3.4).
