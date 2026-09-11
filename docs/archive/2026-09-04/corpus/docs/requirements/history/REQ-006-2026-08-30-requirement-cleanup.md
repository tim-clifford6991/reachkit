# REQ-006 — requirement cleanup, 2026-08-30 (free-funnel merge 5)

Merge decided by the owner's merge map — one card, `BUILD.md` §4.1 module 2.
Count rule inapplicable: `blueprints/` and `work-orders/` hold no artifact, both
counts 0, tie broken by the lower id, which is REQ-006.

## What merged

| id | before | after |
|---|---|---|
| REQ-006 (survivor) | 7 criteria, `status: draft` | 13 criteria, `status: draft`, `supersedes: [REQ-007]` |
| REQ-007 | 6 criteria | `status: superseded`, retired in place |

13 in, 13 out. Nothing collapsed, nothing paraphrased.

## Title

Was: "The AI-answers card states its denominator and names who was cited
instead". Now: "The AI-answers card states its denominator, names who was cited
instead, and shows the search behind each of the 12 questions".

## Criterion mapping — every criterion carried verbatim

| survivor | from | citation repoints inside the criterion |
|---|---|---|
| 1–7 | REQ-006 c1–c7 | none |
| 8 | REQ-007 c1 | — |
| 9 | REQ-007 c2 | — |
| 10 | REQ-007 c3 | — |
| 11 | REQ-007 c4 | — |
| 12 | REQ-007 c5 | — |
| 13 | REQ-007 c6 | "(criterion 2)" → "(criterion 9)" |

## Two criteria deliberately not collapsed

Survivor criteria 2 (REQ-006 c2) and 10 (REQ-007 c3) both fire on a search that
returned no AI answer, and both begin by stating that no AI answer appeared. They
are not duplicates: criterion 2's consequent is exclusion from the citation count
*and its denominator*; criterion 10's is that the row is never presented as the
customer being absent. Collapsing them would have required rewording to keep both
consequents, which this pass does not do. A later pass wanting one criterion
should make that an owner ruling, not an editorial one.

## Front-matter

- `depends-on`: REQ-007's `[REQ-006]` is a self-edge after the merge and was
  dropped; the survivor carries `[]`.
- `rests-on`: none on either. Priority Must on both; survivor Must.

## Non-goals

Union, with "the only correction available is the market itself (REQ-014)"
repointed to REQ-002 and "stated as criterion 6" repointed to criterion 13.

T1 check: no line on either list carries a promise a customer would notice the
absence of — both lists are scope exclusions (no per-engine breakdown, no
sentiment metric, no 50-search set) or pointers to a criterion in the same file.
No T1 promotion in this merge.

## Citations repointed outside this requirement

- REQ-093 `depends-on: [REQ-007]` → `[REQ-006]`; its rationale's "(REQ-007
  criterion 2)" and criterion 3's "in the fuller form REQ-007 criterion 2 fixes"
  → REQ-006 criterion 9; its non-goal "(REQ-007, REQ-071)" → "(REQ-006,
  REQ-071)".
- REQ-002 `depends-on` was written as `[REQ-006]` in merge 3 for this reason.
- JN-001 step 4 `exercises: [REQ-006, REQ-007]` → `[REQ-006]`.
