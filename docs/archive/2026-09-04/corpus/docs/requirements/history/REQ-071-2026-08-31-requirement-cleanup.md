# REQ-071 — requirement cleanup, 2026-08-31 (app cluster, Item 6)

A T1 gap flagged by the previous batch, closed. Not a merge: no requirement was
superseded and no criterion moved. REQ-071 stays `status: draft`.

## The gap

REQ-026 gained criterion 13 for the set the founder leaves setup with — "the set
compared against is exactly the rivals they accepted or typed, no domain they did
not choose ever joining it" — and disclaimed the same promise after setup to
REQ-071. REQ-071 had no equivalent. Its criterion 3 says a domain the customer
adds joins the set, and criterion 8 says every rival comparison shows exactly the
current set, but nothing said the product adds none of its own — and criterion 3
itself names "a domain the product suggests" as one of the two things a customer
may add, so a build could satisfy every criterion on the file while quietly
seeding the set from suggestions.

Under ruling T1 that promise could not be left in REQ-026's non-goal, which was
the only place after setup that it existed at all. Nothing derives a test from a
non-goal.

## What changed

- `requirements/REQ-071.md`: criterion 18 added, shaped like REQ-026 criterion
  13 and scoped to after setup — the set compared against is exactly what the
  customer accepted at setup or has added since, no domain they did not choose
  ever joining it, with the suggestion path explicitly bound ("a domain the
  product suggests at the competitors card joins only when the customer adds it
  (criterion 3)"). Appended at the end, so every existing citation of REQ-071's
  criteria by number is unaffected.
- `requirements/REQ-026.md` non-goal: "after setup it is REQ-071's" → "after
  setup it is REQ-071 criterion 18's", now naming the criterion that carries it
  rather than the file.

## What was left alone

REQ-071's `REVIEW(untestable: criteria 12 and 13)` stands untouched. It is a
`/decide` item about REQ-041's definition of a goal for a rival distance or a
charted series, not a seam, and the Merge 4 pass in this same batch confirmed
that merging REQ-042 into REQ-041 narrows it without settling it. Its citations —
"REQ-041 criterion 4" and "REQ-041's non-goal" — are still correct after that
merge.

## Placement

Unchanged: JN-004 step 2, whose `exercises` already names REQ-071. Criterion 18
is exercised by the same step ("Corrects … the rivals they are measured
against").

## REVIEW lines

- **Died:** none.
- **Survived:** `REVIEW(untestable: criteria 12 and 13)`, untouched.
