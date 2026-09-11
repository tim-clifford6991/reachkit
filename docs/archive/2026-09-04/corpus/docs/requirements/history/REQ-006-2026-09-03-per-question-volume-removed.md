# REQ-006 — history — 2026-09-03

## Amendment: criterion 9 narrowed (per-question volume removed); status `approved` → `in-review`

**Trigger.** Owner ruling C, 2026-09-03, on `OWNER-QUESTIONS.md` item 5
("Per-question monthly search volume on the free report — does it stay?"). The
item's framing, verbatim: "The search text beside each question, which criterion
9 also requires, is what makes the market checkable. Dropping the figure narrows
criterion 9 and edits JN-001 step 5's wording."

**What changed.**
- Criterion 9, narrowed. Was: the search it was derived from, that search's
  monthly search volume, and the brands named in its answer. Now: the search it
  was derived from and the brands named in its answer, and no monthly search
  volume for that search anywhere on the questions module.
- User story and rationale: "the real search and monthly volume behind each of
  the 12 questions" and "the real search and volume it came from" lost the
  volume. The rationale's case for the provenance line is unchanged and is
  carried by the search text, which criterion 13 binds to the measured search.
- Non-goals: one line added stating that no monthly volume sits beside a
  question and pointing at criterion 9, with the volume REQ-008 shows beside the
  searches the customer is absent from named as REQ-008's and not touched.

**What did not change.** Criteria 1–8 and 10–13. Volume remains a selection
input (`BUILD.md` §6.7's volume floor, cited in the rationale) — this amendment
removes it from display only, and the rationale's citation of that clause stands.

**Journey.** JN-001 step 5 was edited from "the search and volume behind each
question" to "the search behind each question"; JN-001 dropped `approved` →
`in-review` in the same edit.

**REVIEW lines deleted.** The `REVIEW(conflict with PROJECT)` line on criterion
9 (this file) and the matching one on JN-001 step 5's wording (that file). Both
named `OWNER-QUESTIONS.md` item 5; both are answered by ruling C.

**Review.** Self-run round one (`skills/review-rounds`). No finding stood: the
narrowed criterion is testable as a presence/absence assertion on the question
row, and no other criterion on this file depended on the figure. No open
`REVIEW(...)` line stands on the file.

**Status.** `approved` → `in-review`. The owner ruled the substance, not this
wording.

**Downstream.** BP-025 satisfies REQ-006. `/sync` should check its question-row
shape and any work order cut from criterion 9.
