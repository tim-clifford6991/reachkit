# REQ-010 — requirement cleanup, 2026-08-30 (free-funnel merge 6)

Merge decided by the owner's merge map — one paragraph, `BUILD.md` §4.2. Count
rule inapplicable: `blueprints/` and `work-orders/` hold no artifact, both counts
0, tie broken by the lower id, which is REQ-010.

## What merged

| id | before | after |
|---|---|---|
| REQ-010 (survivor) | 8 criteria, `status: draft` | 13 criteria, `status: draft`, `supersedes: [REQ-011]` |
| REQ-011 | 5 criteria | `status: superseded`, retired in place |

13 in, 13 out. Nothing collapsed, nothing paraphrased.

## Title

Was: "A finished page is the trade for an email address". Now: "A finished page
is the trade for an email address, and follow-up stops at three per domain".

## Criterion mapping — every criterion carried verbatim

| survivor | from | citation repoints inside the criterion |
|---|---|---|
| 1–8 | REQ-010 c1–c8 | none |
| 9 | REQ-011 c1 | "(criterion 4)" → "(criterion 12)" |
| 10 | REQ-011 c2 | — |
| 11 | REQ-011 c3 — the address-wide opt-out, an owner ruling | — |
| 12 | REQ-011 c4 | "(criterion 2)" → "(criterion 10)"; "(criterion 3)" → "(criterion 11)" |
| 13 | REQ-011 c5 — the per-domain re-entry ruling, an owner ruling | "the three of criterion 1" → "the three of criterion 9" |

Criteria 11 and 13 are the two owner rulings the map named. Both are word for
word what REQ-011 carried; the only edits anywhere in them are the two criterion
numbers in the table above, and criterion 11 has none at all.

## Front-matter

- `depends-on`: REQ-011's `[REQ-010]` is a self-edge after the merge and was
  dropped; the survivor carries `[]`.
- `rests-on`: none on either.
- Priority: REQ-010 Must, REQ-011 Should → survivor **Must**, which raises
  REQ-011's five criteria from Should to Must. Recorded rather than assumed: the
  merge forces one priority on one file, and Must is the survivor's own. If the
  owner meant the nurture sequence to stay deferrable behind the giveaway itself,
  this is the line to overrule — the alternative is to keep them separate, which
  re-opens the seam this merge closed.

## Non-goals

Union, with REQ-011's scheduling deferral repointed ("criterion 4" → "criterion
12").

T1 check: REQ-011's "No follow-up beyond the three touches…, and no second
sequence for a domain that address already has one for" is the one line a
customer would notice the absence of, and criteria 9 and 13 state both halves as
behaviour already. No T1 promotion in this merge.

## Citations repointed outside this requirement

- REQ-025's non-goal "that is `nurture` to an unconverted lead (REQ-011)" →
  REQ-010.
- REQ-064's non-goal listing "REQ-010, REQ-011, …" → REQ-010 once.
- REQ-013 criterion 4, which cited "(REQ-010) or any follow-up (REQ-011)", was
  moved to REQ-064 in the same pass (merge 7) with both citations collapsed to
  REQ-010.
- JN-001 step 9 `exercises: [REQ-010, REQ-011]` → `[REQ-010]`.
