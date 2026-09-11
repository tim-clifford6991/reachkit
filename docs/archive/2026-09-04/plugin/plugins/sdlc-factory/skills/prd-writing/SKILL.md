---
name: prd-writing
description: How to write atomic, testable requirements (REQ) for this factory. Use when creating or editing anything in sdlc-factory/docs/requirements/.
---

# PRD Writing

One REQ = one verifiable behavior — and a behavior is what one journey
step exercises. Split compound statements ("users can register and reset
passwords" → two REQs), and just as firmly refuse to shard one behavior
across files. The merge test, learned at 66 requirements: **two REQs that
cannot state themselves without naming each other are one REQ**, and a
criterion or non-goal whose entire content is routing to a sibling ("a
removed report is REQ-002's") is a seam, not a promise — the rework such
seams attract lands on the boundary text, never the substance, and it
never converges.

## Front-matter

```yaml
---
id: REQ-XXX
type: requirement
title: "<title>"
status: draft
depends-on: []
blocked-by: []
rests-on: []
supersedes: []
---
```

A requirement carries no upstream edge — it is the root of the graph. The
`satisfies`/`covers` edges that link a blueprint back to this REQ live in
the *blueprint's* front-matter, not here.

## Structure

See sdlc-factory/docs/requirements/_TEMPLATE.md: title, priority (MoSCoW),
user story (As a / I want / So that), rationale, acceptance criteria in
Given/When/Then, non-goals, open questions.

## Placement

Every approved requirement stands on a journey step, or the analyst records
why not, in the REQ's own rationale (rule 5.7). Before drafting, read every
`journeys/*.md` and decide: an existing step already covers this ask; it
needs a new step or a new journey (write that as an edit to the journey
file, not a description of one in the REQ); or it has no user-facing step
— state the reason, never leave it silent. A journey step's `exercises`
field is what makes the placement real; a REQ that only claims placement in
its own prose isn't placed.

## What already exists

Before drafting, search the codebase (Grep, Glob) for what the ask already
touches, and cite it by path + symbol — never a bare line number, which
rots on the next edit and silently becomes a wrong address that reads
plausibly (rule 5.3). List what the ask touches in the REQ's rationale. A
REQ written blind to existing code risks asking for something that already
exists, or silently contradicting how it behaves today.

## Rule 2.1 — requirements are sacred

A REQ states behaviour and nothing else. It must not contain argument,
alternatives, vendor evidence, or its own edit history:
- Its changelog lives in `requirements/history/`, not in a section of the
  REQ itself.
- Its evidence (vendor quotes, source citations) lives in
  `registry/evidence/`, cited from there.
- Its open questions are deleted once ruled — they do not accumulate as a
  running log inside the REQ.
- **The cap is seams-aware:** prose fits one screen; criteria carry a
  soft budget of ~12. Past it, look for a second behavior — but never
  split to satisfy length where the halves would have to cite each other
  (rule 2.1: a seam costs more than a long page).

## Altitude — what a criterion is for

A criterion earns its place by what breaks for the user if it stops being
true, not by what the code currently does. Before keeping one, ask: would
the owner reject a build over this? If not, it is description, not
requirement — cut it, or demote it to the rationale's code citation.

This bites hardest when transcribing from running code (`covers`, rule
5.4): the code answers every question at code-level detail, so a
transcribed REQ drifts toward restating mechanisms — an attribute, a CSS
behaviour, a wire-format field — as criteria. The mechanism is *coverage*:
cite it by path + symbol in the rationale. The criterion keeps only the
user-observable promise the mechanism exists to keep.

Scale the whole catalog the same way: a project's requirement count and
criterion depth follow what can go wrong for its users, not its file
count. A read-only site does not need the criterion density of a
transactional product. Three to five criteria is the usual weight of a small
behavior; a journey-step behavior in a transactional product legitimately
carries more, up to rule 2.1's ~12 budget. Past that, check whether you
are transcribing rather than requiring, or holding two behaviors — and if
the split would make halves that cite each other, it is one behavior:
keep it whole.

## Transcribing a settled spec

A written specification the owner has already settled (a BUILD.md, a
signed brief) is the same discipline as transcribing from running code:
the source answers everything at its own grain, and a transcriber drifts
into one REQ per source *bullet* instead of one per *behavior*. Transcribe
at journey-step altitude; cite the section as evidence
(`registry/evidence/`, rule 2.1); the source stays authority for the
argument, the REQ becomes authority for the promise. Review is one round,
not two (rule 3.4): fidelity — did a clause get dropped or reshaped? — and
testability. The two-round treatment is for the drafts that *decide*
something the source left open; say in the return which drafts those are.
A disagreement between transcribed REQs, or between a REQ and its source,
was settled once already — route it to `/decide` or a merge, never into
another review round.

## Corpus-scale intake — skeleton first

A whole product's worth of requirements is never drafted in one pass of
full documents. The first live corpus measured why: 69 requirements took
1,548 edit events — 22 touches each on average, 61 on the worst — because
every seam between concurrently-drafted siblings multiplied rewrites
through its ring. Consistency across N documents is a global property;
drafting is local. Fix the global shape before any full document exists:

1. **Skeleton.** Journeys first; then the cross-cutting laws (the
   null-vs-zero kind — written once, cited ever after); then a slot list,
   one line per intended REQ (title + the journey step it will exercise).
   The owner approves THIS — it is small enough to actually read.
2. **Fill, in isolation.** Each slot is drafted against the frozen
   skeleton and the laws — never against sibling drafts. A fact a sibling
   owns is cited by slot id, not restated; a boundary question goes back
   to the skeleton, not into a Non-goal. Slots sharing no seam fill in
   parallel.
3. **One cross-pass.** The checker, then a single review round for
   fidelity and testability (a settled source already made the
   decisions); what survives goes to the owner as one batch.

The downstream phases already work this way — `/expand-requirement` cuts
a blueprint skeleton before any planner writes a work order, and produced
63 blueprints + 245 work orders in 31 dispatches while requirements spent
109 on 70 files. Requirements were the one layer drafting bodies before
the shape was fixed; this section ends that.

## Other rules

- Ban vague adjectives: fast, simple, robust, secure, scalable. Replace
  with numbers ("p95 < 300ms", "10k concurrent sessions") or a defensible
  derived default, recorded (rule 1.1) — reserve an actual question for
  the owner for cases only they can settle (rule 1.3).
- Acceptance criteria describe observable behavior, never implementation.
- Non-goals are mandatory — the cheapest scope control that exists. They
  state what this product slice will not do; they are never routing
  tables to sibling REQs. A fact another REQ owns has one home — cite it
  once from the rationale if the reader truly needs the pointer, and
  never restate a cross-cutting law as a local criterion.
- Priority conflicts (everything is Must) get pushed back to the user.

Numbering: next free REQ-### (three digits, never reuse). Edits to an
approved REQ add a changelog line under `requirements/history/` and trigger
the librarian's backward pass — never a version block inside the REQ.
