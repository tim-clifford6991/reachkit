# REQ-041 — history — 2026-09-03

## Amendment: criterion 12 added; status reverted `approved` → `in-review`

**Trigger.** Owner ruling 2, 2026-09-03 (`OWNER-QUESTIONS.md` item 2, verbatim):
"The AI-answers card and 'is it working' promise presence over a window — cited
in k of the last n weeks — with movement shown only at the aggregate, never per
question per week." Recorded by the architect as BP-038 decision 5 (the
`AiPresenceWindow` context value, `readOverview` never populating
`aiAnswers.headline.delta`) and BP-005's `AI_PRESENCE_WINDOW_WEEKS` pin.

**Why this file, not a new REQ.** REQ-041 owns Overview's "is it working"
promise (its own rationale: "The single question a subscriber asks every week
is 'is this working?'") and already carries one dedicated criterion per
headline module with a special rendering rule (criteria 2–3 for growth,
8–11 for the rival gap module). The AI-answers headline had none — criterion 4
(the general goal-or-delta rule) is compatible with the ruling but does not
state it, so before this edit the promise that AI-answer movement is shown
only as presence over a window, never per week or per question, had no home
outside BP-038 — a blueprint, which answers "what shape," not "what is
promised." Rule 2.4 (one claim, one home) and rule 5.7 (every promise has a
place) both required a criterion here, not there.

**What was added.** Criterion 12: the AI-answers headline states, alongside
its goal, how many of a fixed trailing window of weeks the customer was named
in at least one tracked question's AI answer, and shows no other reading of
AI-answer movement — no per-week change, no per-question change. Numeric
window size is not stated (system parameter, rule 1.1; pinned as
`AI_PRESENCE_WINDOW_WEEKS` in BP-005, derived in BP-038 decision 5) — this
file states only that a fixed window exists and what it may and may not also
show, which is the customer-facing promise.

**What was not changed.** No other criterion, the rationale, non-goals, or
placement. JN-003 step 1 and JN-005 steps 2–3 already exercise REQ-041 in
general terms ("every number carrying its change or its goal") that cover
this criterion without an edit to either journey.

**Review.** Transcription of a settled, cited specification (BP-038 decision
5, ADR-recorded owner ruling) — round one only (fidelity/testability),
self-run per `skills/review-rounds/SKILL.md`. No ambiguity, gap, conflict or
untestable finding raised against criterion 12 or against criterion 4's
existing goal-or-delta framing, which the new criterion is compatible with
and does not amend.

**Status.** `approved` → `in-review`. The owner's prior approval covered the
text before this criterion existed; this is a new customer-visible promise,
not a wording fix, so the gate reopens (the same principle the journey rule
and `/requirement-cleanup` step 6 apply elsewhere). Downstream: BP-038 already
implements this criterion (it was written from the same ruling first) —
`/sync` should confirm no other blueprint or work order assumed the old,
undefined-for-AI-answers reading of criterion 4.
