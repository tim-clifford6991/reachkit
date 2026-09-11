# REQ-094 — history — 2026-09-03

## Amendment: criterion 8 added (corrected report discloses cached-only AI answers); criterion 3 pointed at it; status `approved` → `in-review`

**Trigger.** Owner ruling A, 2026-09-03, on `OWNER-QUESTIONS.md` item 9 ("Does a
corrected free report still count Google's actual AI answers?"). `CAPS.FREE_C`
stays 12¢, and the lever the owner chose is the item's second one, verbatim:
"Don't pay on the second pass — the correction's twelve SERPs set the flag
`false`. The corrected card then counts only the AI answers Google had cached."
The consequence the owner attached is a customer-visible promise — the corrected
card's disclosure says so — and this file is its only home.

**What changed.**
- Criterion 8 added: a corrected report's AI-answers card carries one written
  line stating that its AI-answer count covers only the AI answers Google had
  already cached for the corrected market's searches, shown on every corrected
  report whether or not the count differs from the report it corrects; and a
  search whose AI answer the correction did not read is shown as one the
  correction did not measure, never as a search on which no AI answer appeared
  and never as a place the customer was absent from (REQ-006 criteria 2 and 10).
  That second sentence is not new law — it is REQ-004's standing rule that an
  unmeasured input is never rendered as a measured zero, applied where this
  amendment creates the case.
- Criterion 3 gained four words: the AI answers are re-measured "on criterion 8's
  terms". Nothing else in criterion 3 changed — the correction still spends no
  further scan allowance, opens no second spend ceiling, and carries one
  measurement date.
- Rationale: one sentence stating that a correction reads only cached AI answers
  and citing `decisions/ADR-094.md` and `blueprints/BP-028.md` decision 4 for why
  — cited, not restated (rule 2.4); the cost arithmetic and the flag are the
  architect's and appear nowhere on this page. The placement line was also
  corrected from "JN-001 step 6" to "step 7", which is where JN-001's `exercises`
  has named REQ-094 since the landing step was added.
- Non-goals: one line stating that no further AI answers are bought for a
  corrected report, pointing at criterion 8.

**Criteria 3 and 7 checked under the ruling, as instructed.**
- Criterion 3 reads correctly: its "spends no further scan allowance and opens no
  second spend ceiling" is exactly the clause the ruling preserves, and it is
  what forced the choice. Amended only to point at criterion 8 so "measured
  again" is not read as buying the AI answers again.
- Criterion 7 reads correctly and is unchanged: "the correction did not complete"
  still covers a correction that ran and produced no report, and the ruling makes
  that the exception it was written to be rather than the ordinary result. Its
  last sentence — a correction whose re-measurement stopped early does produce
  the stored report — is unaffected.

**REVIEW lines deleted.** None; this file carried no open `REVIEW(...)` line.

**Review.** Self-run round one (`skills/review-rounds`). One finding folded:
the first draft of criterion 8 stopped at the disclosure, which would have left
a search the correction never read presentable as REQ-006 criterion 2's "no AI
answer appeared" — a measured zero standing in for an unmeasured one. The second
sentence closes it. No open `REVIEW(...)` line stands on the file.

**Status.** `approved` → `in-review`. The owner ruled the substance; the wording
of a new customer-visible criterion is what the gate reopens for.

**Downstream.** BP-028 satisfies REQ-094 and carries decision 4; ADR-094 carries
the cost decision. Both the architect's, not touched here. `/sync` should check
BP-025's AI-answer card shape for the corrected case and any work order cut from
criterion 3.
