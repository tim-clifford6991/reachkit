# REQ-041 — history — 2026-09-03

## Amendment: criteria 4 and 12 amended, criterion 13 added; two REVIEW lines deleted; status stays `in-review`

**Trigger.** Two owner rulings of 2026-09-03.

- Ruling E, on `OWNER-QUESTIONS.md` item 7 ("Overview's AI-answers tile — one
  reading of AI presence, or two?"): the tile shows one reading — the count of
  weeks the customer was present, named in the trailing window — and carries
  exactly one denominator.
- Ruling F, on item 8 ("Does the composite score keep a tile on Overview?"): the
  composite score has no tile on Overview. The item's framing, verbatim: "the
  head line already answers 'is it working' in words and the three concrete tiles
  answer it in measurements."

**What changed.**
- Criterion 4 gains one sentence: a headline number and whatever it carries —
  its change or its goal — are stated against one and the same denominator, so
  no module puts two readings of one measurement in front of the customer. The
  rest of criterion 4 (one headline number per module, never bare, every headline
  number has a goal, context values unbound) is untouched.
- Criterion 12, rewritten to state the single reading: how many of a fixed
  trailing window of weeks the customer was named in at least one tracked
  question's AI answer, against that window as its only denominator, with what
  criterion 4 makes it carry stated against the same window. Its ban now covers
  a second *reading* and not only second *movement*: no count of tracked
  questions the customer was named in, no per-week change, no per-question
  change.
- Criterion 13 added: the 0–100 score and the band word the report leads with
  (REQ-004 criterion 1) appear nowhere on Overview — no tile, no headline number,
  no band word, no restatement.
- Non-goals: the "second score" line now covers a score of any kind on this
  screen and points at criterion 13; the goal-value line now also covers the
  window's length and names `blueprints/BP-038.md` as where both are derived.

**Parameters not restated (rule 2.4).** The window's length
(`AI_PRESENCE_WINDOW_WEEKS`), and whether `GOAL_VALUES.ai_answers` survives and
in what terms, are BP-038's and BP-005's — the architect is settling BP-038
decisions 2 and 5 in parallel. This file states only that the tile carries one
reading against one denominator, which is the customer-facing promise; criterion
4 leaves the goal free to be expressed against the same window.

**Criterion count.** Thirteen, one past rule 2.1's soft budget of ~12. Not
split: criterion 13 cannot state itself without criteria 2, 4, 8 and 12 — it
says what Overview answers "is it working" with instead — and a seam here costs
more than the long page (rule 2.1).

**REVIEW lines deleted.** `REVIEW(conflict with BP-038)` on the tile's three
denominators (answered by ruling E) and `REVIEW(conflict with PROJECT)` on the
score tile (answered by ruling F).

**Journey.** JN-005's own `REVIEW(conflict with PROJECT)` line — which named
items 7 and 8 as what would bring step 2's screen inside the journey's "under
two minutes" success condition, and said outright that "nothing in this journey
needs rewording for that to happen" — was deleted as answered. No step changed:
step 2 names "every number carrying its change or its goal" and step 3 the rival
distance, neither of which restated the score tile or the AI tile's denominators.
JN-005 therefore stays `approved` (the status rule turns on a step being added or
changed).

**Review.** Self-run round one (`skills/review-rounds`). One finding folded:
criterion 13's first draft grounded Overview's answer in a named list of criteria
including the pending-items and week-strip criteria, which are not measures of
whether the work is working; it now points at the requirement's other criteria
generally. No open `REVIEW(...)` line stands on the file.

**Status.** Unchanged at `in-review` (it had not returned to `approved` since the
2026-09-03 AI-presence-window amendment).

**Downstream.** BP-038 satisfies REQ-041 and holds decisions 2 and 5 and the
Overview tile set; the architect's. `/sync` should check BP-038 and any work
order cut from criteria 4 or 12, and the score tile's absence against the
`readOverview` shape.
