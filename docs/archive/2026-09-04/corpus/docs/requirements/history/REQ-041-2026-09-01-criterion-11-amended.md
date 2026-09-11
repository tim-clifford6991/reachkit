# REQ-041 — criterion 11's exception widened to every goal-less break, 2026-09-01

REQ-071 declared a `blocked-by: [REQ-041]` edge against criterion 11 (rule 2.3).
The amendment below is the resolution the edge named; this entry is the changelog
rule 2.1 puts in `requirements/history/`, written after the fact because the
amending pass's scope was REQ-041's own file. REQ-041 stays `in-review`; no
status was raised by this amendment or by this entry.

## What changed

Criterion 11, before:

> 11. Given the customer appears in 10 or more searches, when the gap module
>     renders, then the ratio is shown together with its previous value; where the
>     customer was below 10 at the previous measurement and no previous ratio
>     exists, it is shown with that measurement's absolute counts instead.

Criterion 11, after:

> 11. Given the customer appears in 10 or more searches, when the gap module
>     renders, then the ratio is shown together with its previous value, except
>     where there is no previous ratio it may be shown with — the customer having
>     been below 10 at the previous measurement, or the previous ratio having been
>     measured on the far side of a date REQ-071 criteria 12 and 13 break every
>     series at — in which case it is shown with its own measurement's absolute
>     counts instead.

No other criterion, non-goal or front-matter field of REQ-041 changed. The
criterion count stays 11.

## Why it changed

REQ-071 criteria 12 and 13 break every series at the date a category change's
rebuilding re-measurement was taken (criterion 7) and at the date a domain
change's effective re-measurement was taken (criterion 9), and state what a
value carrying no goal shows across that break: "it is shown instead with the
counts from its own measurement and the date they were taken, never with that
previous value". REQ-041 criterion 4 classifies the ratio as exactly such a
value — "the rivals' absolute counts and the customer's own number in criterion
10, and the ratio in criterion 11, are such values, carry no goal, and render
without one" — so REQ-071's clause binds the ratio.

The old criterion 11 required the join REQ-071 forbids. Its single exception
fired only on the below-ten crossing, where no previous ratio was ever computed;
at the first re-measurement after a domain or category change a previous ratio
does exist, so the old text required it to be shown and REQ-071 required it not
to be, with no third form to fall back on. Widening the exception from the
below-ten case to the general test — there being no previous ratio the current
one may be shown with — gives both exits the same fallback the criterion already
carried, and leaves the ordinary case (both measurements on the same side of any
break) joining exactly as before. A test written from the old text and a test
written from the new text pass on the same build in every case except the two
REQ-071 breaks, which is precisely the behaviour the amendment changes.

## The referent decision

The fallback's referent was pinned to **"its own measurement's absolute counts"**
rather than the old **"that measurement's absolute counts"**. In the old
single-exit text, "that measurement" trailed the phrase "below 10 at the previous
measurement", so it read as the *previous* measurement's counts — already the
wrong measurement, and harmless only because nothing downstream was forced to
decide. With two exits the phrase has no single antecedent at all, and a
criterion whose referent forks cannot be discriminated by a test: a build showing
the previous measurement's counts and a build showing the current one's would
both satisfy it, which is §8's vacuous test. "Its own" binds to the ratio being
rendered, so the counts are the ones the displayed ratio was computed from.

This matches what REQ-071 criteria 12 and 13 require of a goal-less value across
a break — "the counts from its own measurement", the same referent — so the two
requirements now name one form and not two. REQ-071 keeps the obligation that
those counts carry the date they were taken; criterion 11 does not restate it
(rule 2.4).

No reciprocal edge was added. REQ-071 already carries `depends-on: [REQ-021,
REQ-041, REQ-043, REQ-063, REQ-065, REQ-070]`; an edge from REQ-041 back to
REQ-071 would close a cycle, which §7 forbids. Criterion 11 cites REQ-071 in
prose, which carries the reasoning without adding a graph edge (rule 5.2).

## What this invalidates

- **REQ-071's `blocked-by` edge** — cleared to `[]` and its
  `## Blocked-by — REQ-041 criterion 11 (rule 2.3)` section deleted on
  2026-09-01, the conflict being a state that has ended rather than a log to
  keep. REQ-071 stays `in-review`.
- **WO-159** (`status: approved`) — its `## Test plan` row 11 quotes criterion 11
  in the old single-exit wording verbatim, and its named test
  (`tests/app/overview/rival-module.test.tsx › the ratio arm renders the ratio
  with its previous value, and with the crossing measurement's absolute counts
  where there is no previous ratio`) discriminates only the crossing exit. Its
  `## Self-certification` bullet — "**Criteria inherited, not paraphrased.** The
  4 rows of `## Test plan` quote REQ-041 as it stands on disk." — is now false.
  Re-extract.
- **WO-158** (`status: approved`) — same false self-certification bullet, same
  wording quoted verbatim at `## Test plan` row 11. Its file plan for
  `src/app/(account)/app/overview/rivals.ts` and its step 4 both describe the
  fallback as firing "on the crossing measurement" only, and its resolver
  signature carries
  `previous: Measured<number> | { kind: 'first_ratio'; counts: {...} }`, whose
  discriminant name now describes only one of the two exits. Its row-11 test name
  reads "crossing the threshold this week carries `first_ratio` with **the
  previous measurement's** absolute counts" — the forked referent this amendment
  pinned away, encoded as the test's own assertion. Re-extract.
- **BP-038** — its behaviour rule "At 10 or more it is `ratio`, with the previous
  ratio, or — where the customer crossed the threshold this week — that
  measurement's absolute counts instead (criterion 11)" states the single exit
  and the unpinned referent. The `## Public interface` carries the same
  `first_ratio` discriminant. The architect's, not the analyst's.
- **REQ-042** carries the old text at its criterion 4, and is left untouched: it
  is `superseded`, and rewriting a retired requirement is the no-value
  restructuring rule 2.2a forbids.

## Open — not closed by this amendment

REQ-071 criteria 12 and 13 require a goal-less value across a break to show its
own measurement's counts **and the date they were taken**. Criterion 11's
fallback names the counts and not their date. On the REQ-071 exit that is
correct — REQ-071 owns the date obligation and a second copy here is what rule
2.4 forbids. On the **below-ten** exit, which no REQ-071 break touches, nothing
in the corpus requires those fallback counts to carry a date. Recorded here, not
edited: it is a criterion change and belongs to a pass that has REQ-041 in scope.
