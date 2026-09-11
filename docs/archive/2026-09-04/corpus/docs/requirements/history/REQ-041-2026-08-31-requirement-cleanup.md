# REQ-041 — requirement cleanup, 2026-08-31 (app cluster, Merge 4)

Merge decided by the owner, not by the survivor-count rule: `blueprints/` and
`work-orders/` hold no artifact beyond their templates, so the front-matter
`satisfies:`/`implements:` count naming REQ-041 or REQ-042 is 0 for both. The
count rule was inapplicable and the owner's map decided the survivor.

## What merged

| id | before | after |
|---|---|---|
| REQ-041 (survivor) | 7 criteria, `status: draft` | 11 criteria, `status: draft`, `supersedes: [REQ-042]` |
| REQ-042 | 4 criteria | `status: superseded`, retired in place |

11 criteria in, 11 out; nothing collapsed. Grounds recorded by the owner: one
screen (BUILD §4.5) — Overview. The rival-distance module is one of Overview's
modules, and REQ-041 criterion 4's "max one headline number per module" rule
already governed it from another file.

## Title

Was: "Overview answers whether the work is working, and what needs the customer
today". Now: "Overview answers whether the work is working, what needs the
customer today, and how far ahead each rival still is".

## Criterion mapping — every criterion carried verbatim

| survivor | from |
|---|---|
| 1–7 | REQ-041 c1–c7, unchanged |
| 8 | REQ-042 c1 |
| 9 | REQ-042 c2 |
| 10 | REQ-042 c3 |
| 11 | REQ-042 c4 |

REQ-041's own criteria kept their numbers, so every live citation of them
survives untouched: REQ-065's non-goal and REQ-091's non-goal ("REQ-041 criterion
3"), REQ-092's non-goal ("REQ-041 criterion 5"), REQ-071 criterion 13 ("REQ-041
criterion 4"). REQ-042 carried no internal criterion reference inside its
criteria, so nothing needed renumbering in the carried text.

## The open REVIEW(ambiguity) — narrowed, not closed

REQ-041 carried `REVIEW(ambiguity: criterion 4)`: "headline number" is never
defined, and the goal obligation makes that scope load-bearing because a build
must pin one constant per headline number and cannot enumerate them.

**The merge does not close it, and the line stands.** What the merge changed is
where the question can be answered, not whether it has been. Bringing REQ-042 in
puts one of the two candidate sets of numbers — the rivals' absolute counts and
the customer's own number, now criterion 10 — inside the same requirement as the
rule that would or would not bind them, so the answer no longer needs a
cross-file ruling. But neither source states whether the gap module's numbers are
headline numbers, whether the module's headline number is the gap itself or the
ratio, or which of them is the "value a module shows alongside its headline
number, for comparison or context" that criterion 4 exempts. Nothing in the
merged text decides it, so no test can be derived from criterion 4 for those
numbers. It is a `/decide` item about the definition of a headline number, not a
seam a merge can close.

The line's only edit is a citation repoint made necessary by the merge:
"REQ-042 criterion 3's rivals' absolute counts" → "criterion 10's rivals'
absolute counts". Its substance is unchanged.

The same gap is the subject of REQ-071's `REVIEW(untestable: criteria 12 and
13)`, which cites "REQ-041 criterion 4" and "REQ-041's non-goal". Both citations
are still correct after this merge, so that line was left untouched — and it
remains open for the same reason.

## Verbatim cross-file quotations converted to citations

Required by the corpus ruling in force. Criterion 7 quoted REQ-065's prose twice
— "this week has not been measured" and "what was not measured is stated" — and
now cites REQ-065 criteria 3 and 4 without quoting them. The promise text is
unchanged. The `00-project.md` quotation in the goal-value non-goal is a source
citation, not sibling prose, and was left.

## Non-goals

Unioned, with two collapses:

- REQ-041's "A second score, or any number that answers no question the customer
  has" + REQ-042's "A composite \"competitiveness\" score" → one line naming
  both.
- REQ-041's "Module order, chart geometry, tile widths and colour — design
  system" + REQ-042's "Sparkline geometry, series colours and label placement —
  design system" → one design-system line.

REQ-042's "Suggesting or discovering competitors the customer might add" was
carried with its internal reference renumbered (criterion 1 → criterion 8); it
routes to REQ-070, outside this file, so it is not a seam. No line died. No line
was promoted under ruling T1: the promise in the competitor-suggestion non-goal
is already criterion 8's behaviour ("no site the customer has not confirmed as a
competitor appears in the module"), and the promise in the goal-value non-goal is
already criterion 4's ("a fixed value the product defines for that number, the
same for every customer").

## Front-matter

- `depends-on`: union of [REQ-065, REQ-093] ∪ [] = [REQ-065, REQ-093]. No
  self-edge was created and no cycle was broken.
- `rests-on`: both entries carried, both `open` — REQ-041's `content.`
  subdomain ranking-rows claim and REQ-042's ten-ranked-searches claim.
  REQ-059's non-goal names REQ-041's `rests-on` as the one home of the first;
  that citation is still correct.
- `blocked-by`: empty on both.

## Citations repointed (2 files)

- `journeys/JN-005.md` step 3 `exercises`: [REQ-042] → [REQ-041]. Step 2 already
  named REQ-041; two steps of one journey exercising one requirement is the
  ordinary case. Journey is `status: draft`, so no approval drop.
- `requirements/REQ-091.md` rationale: REQ-042 → REQ-041 in the
  surface-by-surface list.

Nothing inside `REQ-042.md` was repointed; it is the record of what it said.

## Placement

JN-003 step 1, JN-005 steps 2 and 3. Rule 5.7 satisfied, and the rationale
records the placement.

## Anchors

No `Implemented by:` / `Pinned by:` lines existed on either. No non-superseded
blueprint satisfies REQ-041 — no blueprint yet, anchors deferred to
`/expand-requirement`.

## REVIEW lines

- **Died:** none.
- **Survived, carried on the survivor:** `REVIEW(ambiguity: criterion 4)`, with
  its REQ-042 citation repointed to criterion 10 — see above.
- **Survived, untouched, elsewhere:** REQ-071's
  `REVIEW(untestable: criteria 12 and 13)`.
