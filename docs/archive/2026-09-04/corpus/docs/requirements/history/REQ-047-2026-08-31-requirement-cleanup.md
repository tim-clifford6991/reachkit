# REQ-047 — requirement cleanup, 2026-08-31 (app cluster, Merge 1)

Merge decided by the owner, not by the survivor-count rule: `blueprints/` and
`work-orders/` hold no artifact at all beyond their templates, so the
front-matter `satisfies:`/`implements:` count naming REQ-047, REQ-048 or REQ-049
is 0 for each of the three. The count rule was inapplicable and the owner's map
decided the survivor.

## What merged

| id | before | after |
|---|---|---|
| REQ-047 (survivor) | 5 criteria, `status: draft` | 14 criteria, `status: draft`, `supersedes: [REQ-048, REQ-049]` |
| REQ-048 | 3 criteria | `status: superseded`, retired in place |
| REQ-049 | 5 criteria | `status: superseded`, retired in place |

13 criteria in, 14 out — the extra one is the owner's "all three bands must
remain reachable" ruling, made testable (below). Grounds recorded by the owner:
REQ-048's acceptance test and REQ-049's winnability band are attributes of
REQ-047's object, not separate behaviours. One requirement now states what an
opportunity is, what evidence it carries, what test would prove it worked, and
which are winnable enough to queue.

## Title

Was: "Every page proposed comes from measured evidence, and supply is the cap".
Now: "Every page proposed comes from measured evidence, states the test that
would prove it worked, and targets only what the customer could win".

## Criterion mapping — every criterion carried verbatim

| survivor | from |
|---|---|
| 1 | REQ-047 c1 |
| 2 | REQ-047 c2 |
| 3 | REQ-047 c3 |
| 4 | REQ-047 c4 |
| 5 | REQ-047 c5 |
| 6 | REQ-048 c1 |
| 7 | REQ-048 c2 |
| 8 | REQ-048 c3 |
| 9 | REQ-049 c1 |
| 10 | REQ-049 c2 (internal reference "criterion 1" → "criterion 9", twice) |
| 11 | REQ-049 c3 |
| 12 | REQ-049 c4 (REQ-044 criterion 2 → REQ-043 criterion 8, its address after Merge 3) |
| 13 | REQ-049 c5 |
| 14 | new — the owner's band-reachability ruling (below) |

REQ-047's own criteria kept their numbers so that every live citation of them
survives the merge untouched: REQ-091 criterion 1 and its non-goal
("REQ-047 criterion 3"), REQ-043's non-goal ("REQ-047 criterion 4") and REQ-043
criterion 5 ("REQ-047 criterion 5") all still address what they addressed.

No criteria collapsed. The three sources overlapped in subject but stated
different promises: REQ-047 c2 says what evidence an opportunity carries,
REQ-048 c1 what test it carries, REQ-049 c2 what band it carries. Three
attributes of one object, not three statements of one thing.

### The Winnable floor (owner ruling, carried verbatim)

The qualifying bar stays `max(500, 5×ranked)` (criterion 9) and the Winnable
band floor is `max(100, 2×ranked)` (criterion 10). The derivation has one home —
this requirement's second `rests-on` entry, carried from REQ-049 word for word:

> "The floor is 100 rather than 500 because at 500 this expression and criterion
> 9's are equal for every customer ranking below 250 searches, so every queued
> target banded Winnable and the Reach band was unreachable for the cold-start
> founder."

Only the internal criterion number changed with the renumber (`criterion 1's` →
`criterion 9's`). REQ-049's rationale restated the same derivation in its own
prose; that second copy was not carried into the merged rationale (rule 2.4) —
the rationale now cites `rests-on` for it and states only the parameter-authority
point (rule 1.1).

### The one added criterion (criterion 14)

The owner's ruling "all three bands must remain reachable" had no criterion in
either source: REQ-049 c3 promises only that *qualifying* targets exist at
ranked = 0, which is satisfied by a corpus banded entirely Winnable — exactly
the state the floor change was made to end. Nothing derived a test from the
ruling, so it is written as one. It is the owner's promise, not an analyst
decision; the two numbers it constrains stay parameters in `rests-on`.

## Non-goals

Unioned; all eleven lines kept. None routed to a sibling now inside this file —
REQ-048's and REQ-049's non-goals disclaim to REQ-063 and to vendors, both
outside the merge. No line was promoted under ruling T1: every promise the
unioned lines disclaim is already carried by a criterion here — criterion 8 for
a test reworded after publication, criterion 1 for a ninth kind, criterion 2 for
a model inventing evidence, criterion 6 for what a test may say, criterion 13
for per-customer tuning of the threshold.

## Front-matter

- `depends-on`: union of [REQ-093] ∪ [REQ-047] ∪ [REQ-047] = [REQ-093]. The
  REQ-047 edges on REQ-048 and REQ-049 became self-edges and were dropped. No
  cycle was broken.
- `rests-on`: REQ-049's two entries carried, both `open`. REQ-047 and REQ-048
  carried none.
- `blocked-by`: empty in all three.

## Verbatim cross-file quotation converted to a citation

Required by the corpus ruling in force. In `requirements/REQ-063.md` criterion 5,
REQ-048 criterion 1's enumerated forms — "the customer being named in the answer
to a named question" and "a named access barrier being cleared" — were quoted
verbatim; the criterion now reads "whichever of REQ-047 criterion 6's three forms
that test takes". No promise moved. BUILD.md quotes in rationales were left in
place as evidence, per the same ruling.

## Citations repointed (5 files)

- `journeys/JN-003.md` step 3 `exercises`: [REQ-044, REQ-047, REQ-048, REQ-049] →
  [REQ-044, REQ-047] (REQ-044 repointed at Merge 3). Journey is `status: draft`,
  so no approval drop.
- `journeys/JN-005.md` step 4 `exercises`: [REQ-063, REQ-048, REQ-065] →
  [REQ-063, REQ-047, REQ-065]. `status: draft`.
- `requirements/REQ-063.md`: `depends-on` REQ-048 → REQ-047; criterion 5's
  REQ-048 criterion 1 → REQ-047 criterion 6; criterion 6's REQ-048 criterion 3 →
  REQ-047 criterion 8.
- `requirements/REQ-091.md` rationale: REQ-049 → REQ-047 in the
  surface-by-surface list.
- `requirements/REQ-047.md` criterion 12: REQ-044 criterion 2 → REQ-043
  criterion 8.

Nothing inside `REQ-048.md` or `REQ-049.md` was repointed; they are the record of
what they said.

## Placement

JN-003 step 2 (`exercises` already names REQ-047) and step 3; JN-005 step 4 now
names it for the acceptance test REQ-048 used to hold. Rule 5.7 satisfied, and
the rationale records the placement.

## Anchors

No `Implemented by:` / `Pinned by:` lines existed on any of the three. No
non-superseded blueprint satisfies REQ-047 — no blueprint yet, anchors deferred
to `/expand-requirement`.

## REVIEW lines

- **Died:** none — none of the three carried one.
- **Survived:** none opened by this merge.
