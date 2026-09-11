# REQ-008 — history — 2026-09-03

## Amendment: criterion 3 rewritten (market-total footnote removed, both halves); status `approved` → `in-review`

**Trigger.** Owner ruling D, 2026-09-03, on `OWNER-QUESTIONS.md` item 6 ("The
market-total volume footnote — does it stay?"). The item's framing, verbatim:
"Its footnote's second half ('you currently appear in {n}') is already the
customer's own bar restated, which criterion 3's 'exactly once' rule forbids.
Simplest form: neither half."

**What changed.**
- Criterion 3, rewritten. Was: the card states the total monthly search volume
  of the 12 searches, and the customer's presence appears exactly once — the
  top-ten count of criterion 1 — with no second, differently measured figure.
  Now: the customer's presence appears exactly once, labelled on their own bar,
  with no second differently measured figure **and no restatement of that count
  anywhere else on the card**, and no market-total monthly volume is shown. Both
  halves of the footnote are gone and the "exactly once" rule now says outright
  that a restatement of the same count is the thing it forbids.
- Non-goals: one line added naming the removed total and the removed
  restatement, pointing at criterion 3, and stating that criterion 4's per-search
  volume beside each search the customer is absent from is unaffected.

**What did not change.** Criteria 1, 2, 4–10, the user story, the rationale
(whose "every volume beside it is measured in one market" still binds criterion
4's volumes), and the US-English disclosure of criteria 7 and 8.

**Journey.** None. JN-001 step 6 exercises REQ-008 in terms that never named the
total ("their share of those same searches beside each rival, the biggest
searches they are absent from, and the standing line…"), so no step changed and
JN-001's status change on this date comes from the REQ-004 and REQ-006 edits,
not from this one.

**REVIEW line deleted.** The `REVIEW(conflict with PROJECT)` line on criterion
3's `{N}/mo`, which named `OWNER-QUESTIONS.md` item 6. Answered by ruling D.

**Review.** Self-run round one (`skills/review-rounds`). One finding folded
before returning: the first draft removed the total but left "exactly once"
stating only the *differently measured* case, which would still have admitted
the footnote's second half as an identical restatement; the criterion now bars
the restatement explicitly. No open `REVIEW(...)` line stands on the file.

**Status.** `approved` → `in-review`.

**Downstream.** BP-026 satisfies REQ-008 and carries
`PresenceCard.totalMonthlyVolume`, which criterion 3 no longer requires — the
architect's field to retire, named here and not touched. `/sync` should check
BP-026 and any work order cut from criterion 3.
