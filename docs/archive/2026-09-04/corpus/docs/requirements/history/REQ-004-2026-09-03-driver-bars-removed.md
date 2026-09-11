# REQ-004 — history — 2026-09-03

## Amendment: criterion 2 rewritten (driver bars removed); criteria 5, 6, 7, 9 aligned; status `approved` → `in-review`

**Trigger.** Owner ruling B, 2026-09-03, on `OWNER-QUESTIONS.md` item 4 ("The
free report's three driver bars — do they stay?"). The item's own framing of the
form the owner took, verbatim: "Simplest form that keeps the promise: the score
and its band word as the verdict, plus one written line naming which factor
holds the score down." The standing tension the item records is this
requirement's own non-goals, which forbid any on-screen explanation of the
factors or a per-driver drill-down, so the written line names the weakest driver
and explains no composition.

**What changed.**
- Criterion 2, rewritten. Was: the three drivers shown beside the score, each
  named and each with its own value, or "—" for a value the scan could not
  measure. Now: one written line beside a computed score naming the one driver
  that holds the score down the most, named without its value, its weight or how
  the score is put together; no driver's own value shown anywhere on the report;
  the uncomputed case handed to criterion 3. The line explicitly does not touch
  REQ-009's three problem-card counts, which are measurements of their own.
- Criterion 5 — "no part of the score, the band or **the three drivers**" became
  "no part of the score, the band or **the line criterion 2 requires**", so the
  free path's no-blurring promise binds what is now shown.
- Criteria 6 and 9 — "shown and recorded as '—'" became recorded as "—" and
  shown as "—" *wherever the report shows it*, because a driver's own value is no
  longer a thing the report shows. The storage promise is unchanged; the written
  lines and the score's own "—" are unchanged.
- Criterion 7 — the same scoping clause on the measured-zero display promise.
  Storage unchanged, and the noindex ⇒ 0 ⇒ band case is untouched.
- Title and rationale: "its drivers" / "the three things behind it" became "one
  line naming what holds it down". The rationale's placement line was also
  corrected from "JN-001 steps 2 and 3" to "steps 3 and 4", which is where
  JN-001's `exercises` has named REQ-004 since the landing step was added.
- Non-goals: the per-driver drill-down line now also names per-driver values and
  points at criterion 2; a new line assigns the tie-break between two equally low
  drivers to the blueprint (rule 1.1 — a parameter, not a promise).

**Journey.** JN-001 step 4 ("Reads the verdict at the top") was edited from "its
three drivers" to "one written line naming what holds the score down". JN-001
dropped `approved` → `in-review` in the same edit (journey-writing skill: the
signature covered what it signed).

**REVIEW line deleted.** The `REVIEW(conflict with PROJECT)` line on criterion
2's driver values, which named `OWNER-QUESTIONS.md` item 4 as the ruling that
would close it. Answered by ruling B; deleted from the page per rule 2.1 and
recorded here.

**Review.** Self-run round one over the amended text (`skills/review-rounds`).
One finding raised and folded before returning: criterion 2's "no driver's own
value is shown anywhere on the report" read as capable of swallowing REQ-009's
problem-card counts, so the criterion now says it does not. No open
`REVIEW(...)` line stands on the file.

**Status.** `approved` → `in-review`. The owner ruled the substance, not this
wording; the gate reopens for the text (rule 3.4's two rounds, then the owner's
signature).

**Downstream.** BP-024 satisfies REQ-004 and holds the driver rendering; the
architect's, not touched here. `/sync` should check BP-024 and any work order
cut from criterion 2.
