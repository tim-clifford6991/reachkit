# REQ-041 — history — 2026-09-03

## Fold: gap-module `REVIEW(conflict with PROJECT)` line deleted, no criterion changed

**Trigger.** Research-introduced finding (branch `research/ux-simplification`,
merged `4034084`), landed on REQ-041's `## Open questions` alongside two other
lines on the same file.

**Finding.** Criterion 8's gap module was read as rendering one movement three
ways per rival — a series, the current distance, and its previous value
(`BUILD.md` §4.5) — under a written line that teaches the reader how to read
the series, arguing the series is a redundant third copy of the pair criterion
11 already pins, and that dropping it is the design system's call.

**Disposition: folded, no text change.** Re-reading criteria 8 and 11 as
written: neither mandates a series, a sparkline, or any specific visual
encoding. Criterion 8 requires only that the gap's size and its movement over
time be shown; criterion 11 requires the ratio (or the absolute pair below the
threshold) alongside its previous value. The redundant third encoding the
finding names lives in `BUILD.md` §4.5's own worked layout, not in this
requirement's criteria, and REQ-041's own non-goals already route "chart
geometry ... sparkline geometry, series colours and label placement" to the
design system. The requirement already states no more than what must be true
for the customer; there was nothing to narrow or clarify. Derived from REQ-041
itself (rule 1.3) — no owner question raised, since which visual encoding
survives is a design-system parameter (rule 1.1), not a customer-visible
promise.

**What was not changed.** Criteria 8 and 11, rationale, non-goals, placement,
status (`in-review`, unchanged — this file's criterion 12 amendment already
reopened the gate; nothing here reopens it further).

**Review.** Wording/derivable-from-approved-artifact fold under rule 1.3;
round one only, self-run per `skills/review-rounds/SKILL.md` — no new
ambiguity, gap, conflict or untestable finding raised by the fold.

**What stands.** REQ-041's other two open lines — the AI-answers headline's
three denominators and the composite-score tile — are untouched: both are the
artifact-side twins of `OWNER-QUESTIONS.md` items 7 and 8 and are left for the
owner's ruling.
