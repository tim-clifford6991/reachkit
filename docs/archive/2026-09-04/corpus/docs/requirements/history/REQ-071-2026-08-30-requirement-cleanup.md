# REQ-071 — requirement cleanup, 2026-08-30 (Merge B)

Merge decided by the owner, not by the survivor-count rule: `blueprints/` and
`work-orders/` carry no front-matter `satisfies:`/`implements:` line naming
REQ-071, REQ-072 or REQ-080 — all three counts are 0, so the count rule was
inapplicable and the owner's map decided the survivor.

## What merged

| id | before | after |
|---|---|---|
| REQ-071 (survivor) | 6 criteria, `status: draft` | 17 criteria, `status: draft`, `supersedes: [REQ-072, REQ-080]` |
| REQ-072 | 7 criteria | `status: superseded`, retired in place |
| REQ-080 | 5 criteria | `status: superseded`, retired in place |

18 criteria in, 17 out. Grounds recorded by the owner: one decision chain — the
domain, the market and the rival set are the three answers that decide what every
number is a measurement of, and all three take effect the same way.

## Title

Was: "Changing the market rebuilds the question set; leaving it alone freezes
it". Now: "Changing what the site is measured as — domain, market or rivals —
takes effect at the next re-measurement and never reads as movement" (the
owner's proposal, with "rivals" made parallel to the other two).

## Criterion mapping — every criterion carried verbatim

| survivor | from |
|---|---|
| 1 | REQ-071 c1 |
| 2 | REQ-072 c1 |
| 3 | REQ-072 c2 |
| 4 | REQ-072 c5 |
| 5 | REQ-072 c4 |
| 6 | REQ-080 c1 (forward reference "criterion 2" → "criterion 9"; REQ-021 quote converted to a citation) |
| 7 | REQ-071 c2 |
| 8 | REQ-072 c3 |
| 9 | REQ-080 c2 |
| 10 | REQ-071 c5 |
| 11 | collapse of REQ-071 c6 + REQ-080 c3 — see below |
| 12 | REQ-071 c4 |
| 13 | REQ-080 c4 (REQ-041 quote converted to a citation) |
| 14 | REQ-080 c5 (REQ-063 quote converted to a citation) |
| 15 | REQ-071 c3 |
| 16 | REQ-072 c6 (internal reference "criterion 3" → "criterion 8") |
| 17 | REQ-072 c7 |

### The effective-date rule (owner ruling)

Criteria 7, 8 and 9 all carry REQ-080 c2's form — "the first weekly
re-measurement that begins after the moment of the save" — which the owner ruled
the correct one. REQ-071 c2 and REQ-072 c3 already used that wording verbatim, so
no criterion needed changing to comply; criterion 6's written line is bound to it
explicitly ("the customer is never shown one date and given another"), and
criterion 10 states the between-save-and-re-measurement convention once for every
Settings change.

### The one collapse (criterion 11)

REQ-071 c6 (category change holds generation) and REQ-080 c3 (domain change holds
generation) stated one behaviour with the noun changed. The collapsed criterion
takes REQ-071 c6's spine verbatim, widened only in its subject ("a change to the
market category or to the domain"), and appends REQ-080 c3's extra clause
verbatim: "where it is not stopped it publishes under REQ-057's ordinary rule to
the destination the site holds at that moment." Ruling T2 is preserved in the
collapsed text unchanged: a day held by either change "carries one written line
saying which of those two changes is why and naming the date pages resume — never
the empty-pipeline line REQ-043 criterion 3 gives a day with nothing to publish."
A competitor-set change holds no day in either source and holds none here.

### Disambiguation forced by the merge

Three "sets" are now in scope in one file — the search set, the question set and
the competitor set — so criterion 8's antecedent, REQ-072 c3's "Given the
customer changes the set", reads "Given the customer changes the competitor set".
The bare noun was unambiguous in REQ-072 and is not here; nothing else in the
criterion changed, and no promise moved.

## Verbatim cross-file quotations converted to citations

Required by the corpus ruling in force (cite a sibling by ID and criterion
number; do not quote its prose). The promise text is unchanged in every case —
only the quoted sibling prose was removed:

- criterion 6: REQ-021 criterion 5's "does not accept it until an address it can
  reach is given" → "(REQ-021 criterion 5)".
- criterion 13: REQ-041 criterion 4's "either its change since the previous
  measurement or the goal it is moving toward" → "(REQ-041 criterion 4)".
- criterion 14: "it is \"marked as no longer judgeable\" (REQ-063 criterion 6)" →
  "it is marked as no longer judgeable (REQ-063 criterion 6)".
- non-goals: BUILD §6.7's "Not your market? Correct it", BUILD §17's "community
  outreach of any kind", REQ-065's non-goal quote, REQ-070's §4.7 quote and
  REQ-002's non-goal quote removed; the sources now sit in
  `registry/evidence/REQ-071.md` (rule 2.1).

## Non-goals

Unioned. One disclaim-ring line died — REQ-072's "Restating what the product
shows between a saved change and the re-measure that acts on it — REQ-071
criterion 5 states that convention once, for every Settings change (rule 2.4)" —
because it routed to a sibling now inside the same requirement; the convention it
routed to is survivor criterion 10.

REQ-080's non-goal on re-measuring on demand and REQ-071's "Re-measuring
immediately on save" non-goal were themselves duplicates and are unioned into one
line. No non-goal was promoted to a criterion under ruling T1: every promise the
unioned lines disclaim is already carried by a criterion here (7 to 9 for the
effective date, 13 for the previous domain's measurements, 17 for competitor
contact).

## Front-matter

- `depends-on`: union of [REQ-043, REQ-065] ∪ [REQ-065] ∪ [REQ-021, REQ-063,
  REQ-065, REQ-070] = [REQ-021, REQ-043, REQ-063, REQ-065, REQ-070]. REQ-072 and
  REQ-080 were not edges of each other, so no self-edge was created.
- `rests-on`: REQ-071's and REQ-080's time-zone assumptions were the same claim
  in different words, both `confirmed`; carried as one entry naming all three
  kinds of date this requirement states. REQ-072 carried none.

## The REQ-026 / REQ-071 conflict — resolved by this merge, not patched

REQ-026 criterion 4 promised that "every time the product uses their market
afterwards … it is the market they confirmed or stated", which read as taking
effect at the moment of the save, while REQ-071 defers a Settings change to the
next weekly re-measurement. REQ-026 criterion 4 now cites the survivor for both
halves — the control (criterion 1) and the moment it takes effect (criterion 7) —
so one requirement states the effective-date rule and the other cites it
(rule 2.4). Its previous citation of REQ-070 criterion 1 for the control was the
looser of the two and is replaced. No `REVIEW(...)` line had been opened for this
conflict, so none was deleted.

## Citations repointed (11 files)

- `journeys/JN-004.md` step 2 `exercises`: [REQ-080, REQ-071, REQ-072] →
  [REQ-071]. Journey is `status: draft`, so no approval drop.
- `requirements/REQ-021.md` rationale: "REQ-080's (criterion 2" → "REQ-071's
  (criterion 9"; non-goal "REQ-070's and REQ-080's" → "REQ-070's and REQ-071's".
- `requirements/REQ-026.md` criterion 4: see above.
- `requirements/REQ-027.md` rationale and criterion 2: REQ-072 criterion 5 →
  REQ-071 criterion 4; REQ-072 criterion 4 → REQ-071 criterion 5.
- `requirements/REQ-040.md`: `depends-on` REQ-080 → REQ-071; criterion 6's
  REQ-080 criterion 4 → REQ-071 criterion 13.
- `requirements/REQ-063.md` criterion 6: REQ-071 → REQ-071 criterion 7; REQ-080
  criterion 5 → REQ-071 criterion 14.
- `requirements/REQ-065.md` non-goal: "REQ-071 and REQ-072" → "REQ-071".
- `requirements/REQ-070.md` non-goal: REQ-080 criterion 2 → REQ-071 criteria 7
  to 9, widened to name all three controls.
- `requirements/REQ-077.md` non-goal: "REQ-080's" → "REQ-071's".
- `requirements/REQ-091.md` rationale and non-goal: REQ-072 → REQ-071; "REQ-072"
  → "REQ-071 criterion 16".
- `requirements/REQ-093.md` criterion 3: REQ-071 criterion 2 → criterion 7.

## Anchors

No `Implemented by:` / `Pinned by:` lines existed on any of the three. No
non-superseded blueprint satisfies REQ-071 — no blueprint yet, anchors deferred
to `/expand-requirement`.

## REVIEW lines

- **Survived, carried onto the survivor:** REQ-080's
  `REVIEW(untestable: criterion 4)` about "each affected number carrying its goal
  in place of a change" having no pass condition for a rival distance or a
  charted series. The merge did not close it — the gap is against REQ-041's
  definition of a goal, which is outside this merge — and it now bears on
  survivor criteria 12 and 13, since REQ-071 c4 carried the same limb. Restated
  with both numbers on REQ-071's `## Open questions`.
- **Survived, untouched, elsewhere:** REQ-014's `REVIEW(conflict with REQ-026)`
  cites "REQ-071 c1 lets it be replaced in Settings", which is still criterion 1
  after the merge; the conflict it names is REQ-014-vs-REQ-026 on the free path
  and is not the conflict this merge resolved.
- **Died:** none.
