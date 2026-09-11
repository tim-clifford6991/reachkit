# REQ-050 — requirement cleanup, 2026-08-30 (Merge A)

Merge decided by the owner, not by the survivor-count rule: `blueprints/` and
`work-orders/` carry no front-matter `satisfies:`/`implements:` line naming any
of REQ-050, REQ-051, REQ-052 or REQ-054 — both counts are 0 for all four, so the
count rule was inapplicable and the owner's map decided the survivor.

## What merged

| id | before | after |
|---|---|---|
| REQ-050 (survivor) | 4 criteria, `status: draft` | 14 criteria, `status: draft`, `supersedes: [REQ-051, REQ-052, REQ-054]` |
| REQ-051 | 4 criteria | `status: superseded`, retired in place |
| REQ-052 | 5 criteria | `status: superseded`, retired in place |
| REQ-054 | 4 criteria | `status: superseded`, retired in place |

17 criteria in, 14 out. Grounds recorded by the owner: BUILD.md §8 is one hard-rule
list and all four requirements ended in the identical recovery-path clause.

## Title

Was: "Every draft is grounded in a verifiable fact from the customer's own
pages". Now: "A generated draft passes every hard rule or is never queued"
(owner's proposal, "A generated draft passes the hard rules or is never queued",
tightened to name the whole list).

## Criterion mapping — every criterion carried verbatim

| survivor | from |
|---|---|
| 1 | REQ-050 c1 |
| 2 | REQ-050 c3 |
| 3 | REQ-050 c4 |
| 4 | REQ-051 c1 |
| 5 | REQ-051 c3 |
| 6 | REQ-052 c1 |
| 7 | REQ-052 c2 (cross-reference repointed: "REQ-050 criterion 3 and REQ-051 criterion 1" → "criteria 2 and 4") |
| 8 | REQ-052 c3 |
| 9 | REQ-054 c1 |
| 10 | collapse of REQ-050 c2 + REQ-051 c4 + REQ-052 c5 + REQ-054 c2 — see below |
| 11 | REQ-051 c2 |
| 12 | REQ-052 c4 (cross-reference repointed: "criteria 1 to 3" → "criteria 6 to 8") |
| 13 | REQ-054 c3 |
| 14 | REQ-054 c4 |

Criteria 1 to 9 were ordered contiguously so that the collapsed recovery
criterion can name the gate criteria as one range without a fragile numeric list.

### The one collapse (four duplicates into criterion 10)

All four requirements ended in the same consequence. The collapsed criterion is
assembled from the surviving fragments verbatim, so no promise is dropped:

- "the draft is not queued for review … and the item follows the hard-rule
  recovery path (REQ-053 criterion 3)" — REQ-050 c2, REQ-051 c4, REQ-052 c5,
  REQ-054 c2 (identical in all four).
- "no part of it is published or handed to a destination" — REQ-052 c5 only.
- "no page takes its day" — REQ-054 c2 only.

The four antecedents ("no such statement and stored passage could be
established"; "fails any of criteria 1 to 3" ×2; "a candidate at or above that
similarity") are all failures of survivor criteria 1 to 9, and are replaced by
that single range. Nothing else in the four criteria was reworded.

## Non-goals

Unioned. Two disclaim-ring lines lost the routing half that pointed at a sibling
now inside the same requirement:

- REQ-050: "Requiring a different grounded fact for every draft; repetition
  between pages is caught by REQ-054." → the routing clause dropped; the
  substantive non-goal kept.
- REQ-051's and REQ-052's internal criterion references in non-goals renumbered
  ("criteria 1 and 3" → "criteria 4 and 5"; "criteria 1 and 2" → "criteria 4 and
  11"; "criterion 3" → "criterion 8").

No non-goal was promoted to a criterion under ruling T1: none of the unioned
lines withholds a promise a customer would notice the absence of. "Displaying the
grounded fact" remains disclaimed to REQ-045, which carries it as its criterion 2.

## Front-matter

- `depends-on`: union of [REQ-047, REQ-053] ∪ [REQ-053] ∪ [REQ-053] ∪ [REQ-047,
  REQ-053] = [REQ-047, REQ-053]. No self-edge was created.
- `rests-on`: union — REQ-052's 300-character assumption and REQ-054's 85 per
  cent similarity assumption, both carried at `disposition: open`.

## Evidence displaced

The four inline `Source: BUILD.md …` passages moved to
`registry/evidence/REQ-050.md`, cited once from the rewritten rationale (rule
2.1). BUILD §8 rule 4 (do-not-claim) was deliberately not carried there — it is
REQ-053's evidence (rule 2.4).

## Citations repointed

- `journeys/JN-003.md` step 4 `exercises`: REQ-051, REQ-052, REQ-054 removed;
  REQ-050 already present. Journey is `status: draft`, so no approval drop.
- `requirements/REQ-053.md` criterion 3: the four-way citation collapsed to
  "REQ-050 criteria 1 to 9".
- `requirements/REQ-055.md`: `depends-on` REQ-051 → REQ-050; criterion 5's
  "(REQ-051)" → "(REQ-050 criterion 4)".
- `requirements/REQ-079.md` criterion 7 cites "REQ-050 criterion 1" — still
  criterion 1 after the merge; unchanged.

## Anchors

No `Implemented by:` / `Pinned by:` lines existed on any of the four. No
non-superseded blueprint satisfies REQ-050 — no blueprint yet, anchors deferred
to `/expand-requirement`.

## REVIEW lines

None of the four carried a `REVIEW(...)` line, so none died and none survived
here.
